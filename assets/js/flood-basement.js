/* =============================================================
   [반지하와 침수흔적도] — flood-basement.html

   ① 침수흔적도 × 반지하        assets/data/flood/basement-points.json
                                assets/data/flood/source-<src>.json
   ② 침수흔적도 레이어 지도(경기도)  ①이 읽은 폴리곤을 침수심/시기로 나눔
                                assets/data/flood/gg-ref-layers.json (참고 레이어)
   ③ 파이차트 — ①의 선택을 그대로 씁니다.

   ?src=mois     행정안전부_침수흔적도 (safetydata.go.kr OpenAPI)
   ?src=safemap  경기도가 배포한 침수흔적도 SHP
   ============================================================= */
(function () {
  "use strict";

  var SOURCES = {
    mois:    { label: "행정안전부 (safetydata.go.kr)", file: "assets/data/flood/source-mois.json" },
    safemap: { label: "경기도 침수흔적도 SHP",         file: "assets/data/flood/source-safemap.json" }
  };
  var DEFAULT_SRC = "mois";
  var COL_IN = "#facc15", COL_IN_EDGE = "#7c5b00", COL_OUT = "#1a1a1a";

  var state = { src: null, set: "est", showFlood: true, showOut: true };
  var points = null, source = null;
  var map1 = null, ptLayer = null, floodLayer = null;
  var map2 = null, refDoc = null, bandLayers = {}, refLayers = {}, refOn = {};
  var bandBy = "depth";   // depth | year
  var bandCounts = {}, bandOn = {}, pt2Layer = null, showPts2 = true;

  /* ---------- 유틸 ---------- */
  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }
  function num(n) { return Number(n).toLocaleString("ko-KR"); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function busy(id, msg) {
    var b = document.getElementById(id);
    if (!b) return;
    if (msg == null) { b.hidden = true; return; }
    b.hidden = false; b.textContent = msg;
  }
  // 자료는 공개 폴더가 아니라 Supabase 의 비공개 보관함(analysis)에서 받습니다.
  // 승인된 분만 받을 수 있고, 주소를 직접 쳐도 열리지 않습니다.
  function getJSON(url) {
    var path = String(url).replace(/^assets\/data\//, "");   // → "flood/basement-points.json"
    return import("./auth/auth.js").then(function (m) {
      return m.loadAnalysisJson(path);
    });
  }
  // file:// 로 열면 브라우저가 데이터 파일 읽기를 막습니다.
  function fileHint() {
    return location.protocol === "file:" ? " — 웹서버(preview.cmd)로 열어 주세요." : "";
  }
  function baseMap(id, center, zoom) {
    var m = L.map(id, { preferCanvas: true, zoomControl: true, scrollWheelZoom: true })
             .setView(center, zoom);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(m);
    L.control.scale({ imperial: false }).addTo(m);
    return m;
  }

  /* ---------- 위경도 → zoom 0 월드 픽셀 ---------- */
  var R2D = Math.PI / 180;
  function worldX(lon) { return (lon + 180) / 360 * 256; }
  function worldY(lat) {
    var s = Math.sin(lat * R2D);
    s = Math.max(-0.9999, Math.min(0.9999, s));
    return 128 - 256 * Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }

  /* ---------- 반지하 점 캔버스 레이어 ---------- */
  var PointLayer = L.Layer.extend({
    setData: function (wx, wy, flags) {
      this._wx = wx; this._wy = wy; this._flags = flags;
      if (this._canvas) this._redraw();
    },
    onAdd: function (m) {
      this._map = m;
      var c = this._canvas = L.DomUtil.create("canvas", "leaflet-zoom-animated");
      c.style.position = "absolute";
      c.style.pointerEvents = "none";
      m.getPanes().overlayPane.appendChild(c);
      m.on("move zoomend resize viewreset", this._reset, this);
      if (m.options.zoomAnimation && L.Browser.any3d) m.on("zoomanim", this._animateZoom, this);
      this._reset();
    },
    onRemove: function (m) {
      L.DomUtil.remove(this._canvas);
      m.off("move zoomend resize viewreset", this._reset, this);
      m.off("zoomanim", this._animateZoom, this);
    },
    _animateZoom: function (e) {
      var m = this._map,
          scale = m.getZoomScale(e.zoom, m.getZoom()),
          off = m._latLngBoundsToNewLayerBounds(m.getBounds(), e.zoom, e.center).min;
      L.DomUtil.setTransform(this._canvas, off, scale);
    },
    _reset: function () {
      var m = this._map, size = m.getSize(),
          topLeft = m.containerPointToLayerPoint([0, 0]),
          dpr = window.devicePixelRatio || 1, c = this._canvas;
      L.DomUtil.setTransform(c, topLeft, 1);
      if (c.width !== Math.round(size.x * dpr) || c.height !== Math.round(size.y * dpr)) {
        c.width = Math.round(size.x * dpr);
        c.height = Math.round(size.y * dpr);
        c.style.width = size.x + "px";
        c.style.height = size.y + "px";
      }
      this._redraw();
    },
    _redraw: function () {
      var c = this._canvas;
      if (!c) return;
      var ctx = c.getContext("2d"),
          dpr = window.devicePixelRatio || 1,
          m = this._map, size = m.getSize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);
      if (!this._wx) return;

      var z = m.getZoom(), scale = Math.pow(2, z),
          origin = m.getPixelOrigin(), topLeft = m.containerPointToLayerPoint([0, 0]),
          ox = origin.x + topLeft.x, oy = origin.y + topLeft.y,
          wx = this._wx, wy = this._wy, fl = this._flags,
          n = wx.length, W = size.x, H = size.y, i, px, py, TAU = 6.283185307179586;

      if (state.showOut) {
        var r = z >= 13 ? 1.6 : (z >= 11 ? 1.1 : 0.8);
        ctx.fillStyle = COL_OUT;
        ctx.globalAlpha = z >= 11 ? 0.85 : 0.6;
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          if (fl[i]) continue;
          px = wx[i] * scale - ox; if (px < -4 || px > W + 4) continue;
          py = wy[i] * scale - oy; if (py < -4 || py > H + 4) continue;
          ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, TAU);
        }
        ctx.fill();
      }

      var R = z >= 13 ? 4 : (z >= 11 ? 3 : 2.2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = COL_IN; ctx.strokeStyle = COL_IN_EDGE; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (i = 0; i < n; i++) {
        if (!fl[i]) continue;
        px = wx[i] * scale - ox; if (px < -6 || px > W + 6) continue;
        py = wy[i] * scale - oy; if (py < -6 || py > H + 6) continue;
        ctx.moveTo(px + R, py); ctx.arc(px, py, R, 0, TAU);
      }
      ctx.fill();
      if (z >= 12) ctx.stroke();
    }
  });

  /* ---------- ① 데이터 준비 ---------- */
  var projCache = {};
  function projected(setKey) {
    if (projCache[setKey]) return projCache[setKey];
    var s = points.sets[setKey], k = points.scale,
        lon0 = points.lon0, lat0 = points.lat0,
        n = s.n, wx = new Float64Array(n), wy = new Float64Array(n), i;
    for (i = 0; i < n; i++) {
      wx[i] = worldX(lon0 + s.x[i] / k);
      wy[i] = worldY(lat0 + s.y[i] / k);
    }
    projCache[setKey] = { wx: wx, wy: wy };
    return projCache[setKey];
  }
  function flagsOf(setKey) {
    var str = source.flags[setKey], n = str.length, a = new Uint8Array(n), i;
    for (i = 0; i < n; i++) a[i] = str.charCodeAt(i) === 49 ? 1 : 0;
    return a;
  }

  /* ---------- ③ 도넛 ---------- */
  function arcPath(cx, cy, r, w, a0, a1, color) {
    var ri = r - w, large = (a1 - a0) > Math.PI ? 1 : 0;
    if (a1 - a0 >= Math.PI * 2 - 1e-6) {
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r - w / 2) +
             '" fill="none" stroke="' + color + '" stroke-width="' + w + '"/>';
    }
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0),
        x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1),
        x2 = cx + ri * Math.cos(a1), y2 = cy + ri * Math.sin(a1),
        x3 = cx + ri * Math.cos(a0), y3 = cy + ri * Math.sin(a0);
    return '<path d="M' + x0 + " " + y0 + "A" + r + " " + r + " 0 " + large + " 1 " + x1 + " " + y1 +
           "L" + x2 + " " + y2 + "A" + ri + " " + ri + " 0 " + large + " 0 " + x3 + " " + y3 +
           'Z" fill="' + color + '" stroke="#fff" stroke-width="1.2"/>';
  }
  function drawPie(svgId, inside, outside) {
    var svg = document.getElementById(svgId), total = inside + outside;
    if (!svg || !total) return;
    var a0 = -Math.PI / 2, html = "";
    [{ v: outside, c: COL_OUT }, { v: inside, c: COL_IN }].forEach(function (p) {
      if (!p.v) return;
      var a1 = a0 + (p.v / total) * Math.PI * 2;
      html += arcPath(100, 100, 74, 30, a0, a1, p.c);
      a0 = a1;
    });
    html += '<text class="fb-pie__big" x="100" y="97" text-anchor="middle">' +
            (inside / total * 100).toFixed(1) + "%</text>" +
            '<text class="fb-pie__small" x="100" y="117" text-anchor="middle">흔적도 안</text>';
    svg.innerHTML = '<title>침수흔적도 내·외 반지하 비율</title>' + html;
  }

  /* ---------- ①+③ 갱신 ---------- */
  function renderSide() {
    var st = source.stats[state.set], s = points.sets[state.set];
    drawPie("fb-pie", st.inside, st.outside);

    document.getElementById("fb-pie-sub").textContent = s.short + " " + num(st.total) + "호";
    document.getElementById("fb-src-label").textContent = source.label;
    document.getElementById("fb-chart-src").textContent = source.label + " 기준";

    document.getElementById("fb-keys").innerHTML =
      '<div><i style="background:' + COL_IN + ';border:1px solid ' + COL_IN_EDGE + '"></i>침수흔적도 안<b>' +
        num(st.inside) + "호</b></div>" +
      '<div><i style="background:' + COL_OUT + '"></i>침수흔적도 밖<b>' + num(st.outside) + "호</b></div>";

    var rows = (source.bySgg[state.set] || []).filter(function (r) { return r.inside > 0; });
    document.getElementById("fb-sgg").innerHTML = rows.length
      ? rows.map(function (r) {
          return "<tr><td>" + esc(r.sgg) + "</td><td>" + num(r.total) + "</td><td>" +
                 num(r.inside) + "</td><td>" + r.ratio.toFixed(1) + "%</td></tr>";
        }).join("")
      : '<tr><td colspan="4">해당 없음</td></tr>';

    var yrs = source.years && source.years.length
      ? source.years[0] + "–" + source.years[source.years.length - 1] : "—";
    document.getElementById("fb-meta").innerHTML =
      "<dt>침수흔적도</dt><dd>" + esc(source.label) + " · 경기도 " + num(source.polygonCount) +
        "개 구역 · 수록연도 " + yrs + "</dd>" +
      "<dt>반지하</dt><dd>" + esc(s.label) + " · " + num(s.n) + "호<br>" + esc(s.note) + "</dd>" +
      "<dt>판정</dt><dd>point-in-polygon · 좌표계 EPSG:5179</dd>";
  }

  function renderFlood() {
    if (floodLayer) { map1.removeLayer(floodLayer); floodLayer = null; }
    if (!state.showFlood) return;
    floodLayer = L.geoJSON(source.geojson, {
      renderer: L.canvas({ padding: 0.3 }),
      style: { color: "#1d4ed8", weight: 0.7, opacity: 0.8, fillColor: "#3b82f6", fillOpacity: 0.35 },
      onEachFeature: function (f, lyr) {
        var p = f.properties || {};
        lyr.bindPopup(
          "<strong>" + esc(p.disaster || "침수흔적") + "</strong><br>" +
          (p.year ? esc(p.year) + "년<br>" : "") +
          (p.cause ? esc(p.cause) + "<br>" : "") +
          (p.depth != null ? "평균 침수심 " + p.depth + " m<br>" : "") +
          (p.area != null ? "면적 " + num(p.area) + " ㎡" : ""));
      }
    }).addTo(map1);
    floodLayer.bringToBack();
  }

  function refresh1() {
    var pr = projected(state.set);
    ptLayer.setData(pr.wx, pr.wy, flagsOf(state.set));
    renderFlood();
    renderSide();
    syncChips();
    refresh2();
  }

  function syncChips() {
    document.querySelectorAll("[data-src]").forEach(function (b) {
      var on = b.dataset.src === state.src;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("[data-set]").forEach(function (b) {
      var on = b.dataset.set === state.set;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function loadSource(src) {
    busy("fb-busy1", "침수흔적도(" + SOURCES[src].label + ") 를 불러오는 중입니다…");
    return getJSON(SOURCES[src].file).then(function (j) {
      source = j; state.src = src;
      try { history.replaceState(null, "", "flood-basement.html?src=" + src); } catch (e) {}
      refresh1();
      busy("fb-busy1", null);
      // ②는 ①과 같은 폴리곤을 쓰므로 출처가 바뀔 때만 다시 만든다
      buildBands();
      busy("fb-busy2", null);
      var l2 = document.getElementById("fb-src-label2");
      if (l2) l2.textContent = source.label + " · 경기도 " + num(source.polygonCount) + "개 구역";
    }).catch(function (err) {
      console.warn(err.message);
      var chip = document.querySelector('[data-src="' + src + '"]');
      if (chip && !chip.disabled) {
        chip.disabled = true; chip.title = "자료 준비 중";
        chip.textContent += " (준비 중)";
      }
      if (source) { busy("fb-busy1", null); syncChips(); return; }
      busy("fb-busy1", SOURCES[src].label + " 자료가 아직 없습니다. 다른 출처를 선택해 주세요.");
    });
  }

  /* ---------- ② 침수흔적도 레이어 지도 (경기도) ----------
     지도 ①이 이미 읽은 폴리곤을 그대로 다시 써서 침수심 / 침수 시기로 나눕니다.
     반지하 점도 같이 얹고, 켜 놓은 구간만으로 비율을 다시 셉니다.
     구간 정의(bandSpec)와 점별 구간 번호(bandFlags)는 source-<src>.json 에 들어 있어
     ①의 판정과 완전히 같은 계산을 씁니다.                                        */

  function bandSpec() { return source && source.bandSpec ? source.bandSpec[bandBy] : null; }
  function bandProp() { return bandBy === "depth" ? "db" : "yb"; }

  function floodPopup(f, bandLabel) {
    var p = f.properties || {};
    return "<strong>" + esc(p.disaster || "침수흔적") + "</strong><br>" +
           (p.year ? esc(p.year) + "년<br>" : "") +
           (p.cause ? esc(p.cause) + "<br>" : "") +
           (p.depth != null ? "평균 침수심 " + p.depth + " m<br>" : "") +
           (p.area != null ? "면적 " + num(p.area) + " ㎡<br>" : "") +
           '<span style="color:#6b6360">' + esc(bandLabel) + "</span>";
  }

  function refPopup(layer, f) {
    var p = f.properties || {}, rows = [];
    if (p.name) rows.push(esc(p.name));
    if (p.ymd) rows.push("고시 " + esc(p.ymd));
    if (p.sgg_cd) rows.push("시군구코드 " + esc(p.sgg_cd));
    return "<strong>" + esc(layer.label) + "</strong>" + (rows.length ? "<br>" + rows.join("<br>") : "");
  }

  /* 현재 구분 기준으로 폴리곤 레이어를 다시 만든다 (출처가 바뀔 때만 호출) */
  function buildBands() {
    Object.keys(bandLayers).forEach(function (k) {
      if (map2.hasLayer(bandLayers[k])) map2.removeLayer(bandLayers[k]);
    });
    bandLayers = {};
    var spec = bandSpec();
    if (!spec) return;

    var prop = bandProp(), renderer = L.canvas({ padding: 0.3 }), counts = {};
    spec.bands.forEach(function (b, i) {
      if (bandOn[i] === undefined) bandOn[i] = true;
      var lyr = L.geoJSON(source.geojson, {
        renderer: renderer,
        filter: function (f) {
          var v = (f.properties || {})[prop];
          var hit = (v == null ? spec.bands.length - 1 : v) === i;
          if (hit) counts[i] = (counts[i] || 0) + 1;
          return hit;
        },
        style: { color: b.color, weight: 0.6, opacity: 0.9, fillColor: b.color, fillOpacity: 0.5 },
        onEachFeature: function (f, x) { x.bindPopup(floodPopup(f, spec.label + " " + b.label)); }
      });
      bandLayers[i] = lyr;
      if (bandOn[i]) lyr.addTo(map2);
    });

    Object.keys(refLayers).forEach(function (id) {
      if (refOn[id]) refLayers[id].addTo(map2).bringToFront();
    });

    bandCounts = counts;
    renderLayerControls(counts);
    refresh2();
    fitGG();
  }

  function fitGG() {
    var b = null;
    Object.keys(bandLayers).forEach(function (k) {
      var lb = bandLayers[k].getBounds();
      if (!lb.isValid()) return;
      b = b ? b.extend(lb) : L.latLngBounds(lb.getSouthWest(), lb.getNorthEast());
    });
    if (b) map2.fitBounds(b.pad(0.05));
  }

  /* 켜 놓은 구간만으로 반지하 점 플래그와 비율을 다시 만든다 */
  function bandFlagsOf(setKey) {
    var str = source.bandFlags[bandBy][setKey], n = str.length,
        a = new Uint8Array(n), per = {}, inside = 0, i, c, idx;
    for (i = 0; i < n; i++) {
      c = str.charCodeAt(i);
      if (c === 46) continue;                       // '.' = 흔적도 밖
      idx = c - 48;
      per[idx] = (per[idx] || 0) + 1;
      if (bandOn[idx]) { a[i] = 1; inside++; }
    }
    return { flags: a, inside: inside, total: n, perBand: per };
  }

  function refresh2() {
    if (!source || !points || !source.bandFlags) return;
    var r = bandFlagsOf(state.set);
    var pr = projected(state.set);
    if (!pt2Layer) { pt2Layer = new PointLayer(); if (showPts2) pt2Layer.addTo(map2); }
    pt2Layer.setData(pr.wx, pr.wy, r.flags);   // 켜고 끄기는 레이어 자체를 붙였다 떼서 처리

    drawPie("fb-pie2", r.inside, r.total - r.inside);
    var s = points.sets[state.set], spec = bandSpec();
    var allOn = spec.bands.every(function (b, i) { return !bandCounts[i] || bandOn[i]; });

    document.getElementById("fb-pie2-sub").textContent =
      s.short + " " + num(r.total) + "호 · " +
      (allOn ? "모든 구간" : "선택한 구간만");

    document.getElementById("fb-keys2").innerHTML =
      '<div><i style="background:' + COL_IN + ';border:1px solid ' + COL_IN_EDGE + '"></i>선택 구간 안<b>' +
        num(r.inside) + "호</b></div>" +
      '<div><i style="background:' + COL_OUT + '"></i>그 밖<b>' + num(r.total - r.inside) + "호</b></div>";

    // 구간별 반지하 수 — 켜고 끈 것과 무관하게 전부 보여 준다
    document.getElementById("fb-band-table").innerHTML = spec.bands.map(function (b, i) {
      if (!bandCounts[i] && !r.perBand[i]) return "";
      var v = r.perBand[i] || 0;
      return "<tr" + (bandOn[i] ? "" : ' style="opacity:.45"') + "><td>" +
             '<span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' +
             b.color + ';margin-right:.4rem"></span>' + esc(b.label) + "</td><td>" +
             num(bandCounts[i] || 0) + "</td><td>" + num(v) + "</td><td>" +
             (r.total ? (v / r.total * 100).toFixed(2) : "0.00") + "%</td></tr>";
    }).join("");

    var same = document.getElementById("fb-match");
    if (same) {
      var st1 = source.stats[state.set];
      same.textContent = allOn
        ? "모든 구간을 켜면 지도 ①과 같은 " + num(st1.inside) + "호(" + st1.ratio.toFixed(2) + "%) 입니다."
        : "지도 ① 전체 기준은 " + num(st1.inside) + "호(" + st1.ratio.toFixed(2) + "%) 입니다.";
    }
    renderLegend2(bandCounts);
  }

  function renderLayerControls(counts) {
    var spec = bandSpec(), specs = source.bandSpec;
    var html = '<fieldset><legend>구분 기준</legend>' +
      Object.keys(specs).map(function (k) {
        return '<button type="button" class="chip' + (k === bandBy ? " active" : "") +
               '" data-band="' + k + '" aria-pressed="' + (k === bandBy) + '">' +
               esc(specs[k].label) + "</button>";
      }).join("") + "</fieldset>";

    html += '<fieldset><legend>' + esc(spec.label) + "</legend>" +
      spec.bands.map(function (b, i) {
        if (!counts[i]) return "";
        return '<label class="fb-check"><input type="checkbox" data-band-layer="' + i + '"' +
               (bandOn[i] ? " checked" : "") + '>' +
               '<span class="sw" style="background:' + b.color + '"></span>' + esc(b.label) +
               ' <span style="color:#8b8280">' + num(counts[i]) + "</span></label>";
      }).join("") + "</fieldset>";

    html += '<fieldset><legend>반지하</legend><label class="fb-check">' +
            '<input type="checkbox" id="fb-show-pts2"' + (showPts2 ? " checked" : "") + "> 점 표시</label></fieldset>";

    if (refDoc) {
      html += '<fieldset><legend>참고 레이어</legend>' + refDoc.layers.map(function (l) {
        return '<label class="fb-check"><input type="checkbox" data-ref-layer="' + l.id + '"' +
               (refOn[l.id] ? " checked" : "") + '>' +
               '<span class="sw" style="background:' + l.color + '"></span>' + esc(l.label) +
               ' <span style="color:#8b8280">' + num(l.count) + "</span></label>";
      }).join("") + "</fieldset>";
    }

    var mount = document.getElementById("fb-layers");
    mount.innerHTML = html;

    mount.querySelectorAll("[data-band]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.band === bandBy) return;
        bandBy = b.dataset.band;
        bandOn = {};
        buildBands();
      });
    });
    mount.querySelectorAll("[data-band-layer]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var i = +cb.dataset.bandLayer, lyr = bandLayers[i];
        bandOn[i] = cb.checked;
        if (lyr) { if (cb.checked) lyr.addTo(map2); else map2.removeLayer(lyr); }
        refresh2();
      });
    });
    mount.querySelectorAll("[data-ref-layer]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var lyr = refLayers[cb.dataset.refLayer];
        if (!lyr) return;
        refOn[cb.dataset.refLayer] = cb.checked;
        if (cb.checked) lyr.addTo(map2).bringToFront(); else map2.removeLayer(lyr);
        renderLegend2(bandCounts);
      });
    });
    var sp = document.getElementById("fb-show-pts2");
    if (sp) sp.addEventListener("change", function () {
      showPts2 = this.checked;
      if (pt2Layer) { if (showPts2) pt2Layer.addTo(map2); else map2.removeLayer(pt2Layer); }
    });
  }

  function renderLegend2(counts) {
    var spec = bandSpec();
    if (!spec) return;
    var html = spec.bands.map(function (b, i) {
      if (!counts[i] || !bandOn[i]) return "";
      return '<div><i style="border-radius:3px;background:' + b.color + '99;border:1px solid ' +
             b.color + '"></i>' + esc(b.label) + "</div>";
    }).join("");
    if (showPts2) {
      html += '<div><i style="background:' + COL_IN + ';border:1px solid ' + COL_IN_EDGE +
              '"></i>선택 구간 안 반지하</div>' +
              '<div><i style="background:' + COL_OUT + '"></i>그 밖 반지하</div>';
    }
    if (refDoc) {
      html += refDoc.layers.filter(function (l) { return refOn[l.id]; }).map(function (l) {
        return '<div><i style="border-radius:3px;background:' + l.color + '99;border:1px solid ' +
               l.color + '"></i>' + esc(l.label) + "</div>";
      }).join("");
    }
    document.getElementById("fb-legend2").innerHTML = html;
  }

  function buildRefLayers(doc) {
    refDoc = doc;
    var renderer = L.canvas({ padding: 0.3 });
    doc.layers.forEach(function (l) {
      refOn[l.id] = !!l.default;
      refLayers[l.id] = L.geoJSON(l.geojson, {
        renderer: renderer,
        style: { color: l.color, weight: 1.2, opacity: 0.95, fillColor: l.color, fillOpacity: 0.35 },
        onEachFeature: function (f, x) { x.bindPopup(refPopup(l, f)); }
      });
      if (refOn[l.id]) refLayers[l.id].addTo(map2);
    });
  }

  /* ---------- 시작 ---------- */
  function start() {
    if (!document.getElementById("fb-map1")) return;

    map1 = baseMap("fb-map1", [37.42, 127.1], 9);
    ptLayer = new PointLayer().addTo(map1);

    map2 = baseMap("fb-map2", [37.42, 127.1], 9);

    var src = qs("src");
    if (!SOURCES[src]) src = DEFAULT_SRC;

    busy("fb-busy1", "반지하 자료를 불러오는 중입니다…");
    getJSON("assets/data/flood/basement-points.json")
      .then(function (j) { points = j; return loadSource(src); })
      .catch(function (err) {
        console.error(err);
        busy("fb-busy1", "자료를 불러오지 못했습니다: " + err.message + fileHint());
      });

    busy("fb-busy2", "레이어를 준비하는 중입니다…");
    getJSON("assets/data/flood/gg-ref-layers.json")
      .then(buildRefLayers)
      .catch(function (err) { console.warn("참고 레이어 없음:", err.message); })
      .then(function () { if (source) { buildBands(); busy("fb-busy2", null); } });

    document.querySelectorAll("[data-src]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.disabled || b.dataset.src === state.src) return;
        loadSource(b.dataset.src);
      });
    });
    document.querySelectorAll("[data-set]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.set === state.set) return;
        state.set = b.dataset.set;
        refresh1();
      });
    });
    document.getElementById("fb-show-flood").addEventListener("change", function () {
      state.showFlood = this.checked; renderFlood();
    });
    document.getElementById("fb-show-out").addEventListener("change", function () {
      state.showOut = this.checked; ptLayer._redraw();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
