/* =============================================================
   [경기도 노후 산업단지 — 역세권과 인구밀도] — aging-complex.html

   ① 지도 : 산단 경계(노후년도 10급간 붉은색) × 철도역 × 인구밀도 격자(6단계 초록) × 역세권 1km 안 산단 영역
            시군 이름은 진한 회색, 산단 이름은 파란색 — QGIS 화면(GG_노후산단분석.qgz)과 같게
            · 역을 누르면 반경(500m~2km) 원을 그리고 안에 걸치는 산단을 셉니다
            · 「거리 재기」 로 아무 두 점 사이를 잽니다 (직선거리)
            · 산단을 누르면 노후년도·가장 가까운 역, 빈 곳을 누르면 그 자리의 인구밀도
            · 큰 층 넷(산단 노후년도 · 인구밀도 · 도시쇠퇴도 8유형 · 공업 용도지역)을 한 지도에 얹고 각각 켜고 끕니다
            · 역세권 1km 버퍼(원)는 역 자료로 그립니다 (station_buffer_1km.json 과 같은 1,000m)
   ② 표   : 역세권 1km 안 산단 (station_1km_summary.json) — 머리글을 누르면 정렬, 다시 누르면 방향 바뀜
   그림 확대 : .ag-zoom 그림을 누르면 라이트박스(휠 확대·끌기)

   자료 : assets/data/aging/*.json · pop_density.png (tools/aging/build_aging.py 가 만듭니다)
          assets/data/aging/analysis/* (산단 분석 세션이 만든 역세권 교차 결과)
   ============================================================= */
(function () {
  "use strict";
  var D = "assets/data/aging/";
  var GG_CENTER = [37.42, 127.05], GG_ZOOM = 9;
  var DAN_ZOOM = 10;                                   // 산단 이름은 이 줌부터
  /* QGIS 등급 색 그대로 (노후년도 0~62, 10급간) */
  var AGE_CLASSES = [
    [0, 6, "#ffffff"], [6, 11, "#f3e3e3"], [11, 15, "#e8c6c6"], [15, 19, "#dcaaaa"], [19, 26, "#d18e8e"],
    [26, 32, "#c57171"], [32, 36, "#ba5555"], [36, 42, "#ae3939"], [42, 53, "#a31c1c"], [53, 63, "#970000"],
  ];
  var UNMATCHED = "#8f9a9e";
  var ZONE = { color: "#b3001b", fillColor: "#ff1744", fillOpacity: 0.55, weight: 1 };

  var num = function (n) { return Number(n).toLocaleString("ko-KR"); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  function ageColor(a) {
    if (a == null) return UNMATCHED;
    for (var i = AGE_CLASSES.length - 1; i >= 0; i--) if (a >= AGE_CLASSES[i][0]) return AGE_CLASSES[i][2];
    return AGE_CLASSES[0][2];
  }
  function busy(msg) {
    var b = document.getElementById("ag-busy0");
    if (!b) return;
    if (msg == null) { b.hidden = true; return; }
    b.hidden = false; b.textContent = msg;
  }
  var VER = "202609160200";                              // 자료를 다시 만들면 올립니다 (브라우저가 옛 파일을 쓰지 않게)
  function getJSON(u) {
    return fetch(u + "?v=" + VER).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
  }
  /* 두 점 사이 직선거리(m) — Leaflet 의 구면 거리 */
  function dist(a, b) { return L.latLng(a).distanceTo(L.latLng(b)); }
  /* 점에서 선분까지의 거리(m) — 역 둘레 몇 km 라 평면으로 봐도 됩니다 */
  function segDist(p, a, b) {
    var kx = 111320 * Math.cos(p[0] * Math.PI / 180), ky = 110540;
    var px = (p[1] - a[1]) * kx, py = (p[0] - a[0]) * ky;
    var bx = (b[1] - a[1]) * kx, by = (b[0] - a[0]) * ky;
    var l2 = bx * bx + by * by;
    var t = l2 ? Math.max(0, Math.min(1, (px * bx + py * by) / l2)) : 0;
    var dx = px - t * bx, dy = py - t * by;
    return Math.sqrt(dx * dx + dy * dy);
  }
  /* 점에서 폴리곤 경계까지 최단거리(m) — 안에 있으면 0 */
  function ringsOf(geom) {
    var out = [];
    var polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    polys.forEach(function (poly) { poly.forEach(function (ring) { out.push(ring); }); });
    return out;
  }
  function inRing(p, ring) {                         // ray casting, ring = [[lon,lat],…]
    var x = p[1], y = p[0], inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polyDist(p, geom) {
    var polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    var best = Infinity;
    for (var k = 0; k < polys.length; k++) {
      if (inRing(p, polys[k][0])) return 0;
      polys[k].forEach(function (ring) {
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          var d = segDist(p, [ring[j][1], ring[j][0]], [ring[i][1], ring[i][0]]);
          if (d < best) best = d;
        }
      });
    }
    return best;
  }

  /* ---------- 지도 ---------- */
  var map, base = null, layers = {}, popImg = null, popMeta = null, popGrid = null, decMeta = null, indMeta = null;
  var cxLayer, cxIndex = [], stations = [], stMarks = [];
  var radius = 1000, ring = null, ringDash = null, side;
  var measuring = false, mPts = [], mLine = null, mTips = [];

  function init() {
    side = document.getElementById("ag-side");
    map = L.map("ag-map0", { preferCanvas: true, scrollWheelZoom: true, doubleClickZoom: false }).setView(GG_CENTER, GG_ZOOM);
    L.control.scale({ imperial: false }).addTo(map);
    window.__agMap = map;                                // 시험·디버그용 손잡이
    map.createPane("popPane"); map.getPane("popPane").style.zIndex = 250;      // 격자는 맨 아래
    map.createPane("decPane"); map.getPane("decPane").style.zIndex = 260;      // 도시쇠퇴도
    map.createPane("indPane"); map.getPane("indPane").style.zIndex = 270;      // 공업 용도지역
    map.createPane("bufPane"); map.getPane("bufPane").style.zIndex = 280;      // 역세권 1km 버퍼
    map.createPane("emdPane"); map.getPane("emdPane").style.zIndex = 300;
    map.createPane("sigPane"); map.getPane("sigPane").style.zIndex = 310;
    map.createPane("cxPane"); map.getPane("cxPane").style.zIndex = 400;
    map.createPane("zonePane"); map.getPane("zonePane").style.zIndex = 410;
    map.createPane("stPane"); map.getPane("stPane").style.zIndex = 420;
    map.createPane("lblPane"); map.getPane("lblPane").style.zIndex = 600;
    var box = document.getElementById("ag-map0");
    var syncZoom = function () { box.classList.toggle("z-lo", map.getZoom() < DAN_ZOOM); };
    map.on("zoomend", syncZoom); syncZoom();

    busy("자료를 불러오는 중입니다…");
    Promise.all([
      getJSON(D + "sido.json"), getJSON(D + "sig.json"), getJSON(D + "emd.json"),
      getJSON(D + "complexes.json"), getJSON(D + "stations.json"), getJSON(D + "pop_meta.json"),
      getJSON(D + "analysis/station_1km_area.json").catch(function () { return null; }),
      getJSON(D + "analysis/decline_8class.json").catch(function () { return null; }),
      getJSON(D + "analysis/industrial_zone.json").catch(function () { return null; }),
    ]).then(function (r) {
      drawBoundaries(r[0], r[1], r[2]);
      drawPop(r[5]);
      drawDecline(r[7]);
      drawIndustrial(r[8]);
      drawBuffer(r[4]);
      drawComplexes(r[3]);
      drawZone(r[6]);
      drawStations(r[4]);
      legend();
      wire();
      lightbox();
      busy(null);
      var n = r[3].features.length, m = r[3].features.filter(function (f) { return f.properties.matched; }).length;
      document.getElementById("ag-src").textContent = "산단 경계 " + n + "곳(목록 짝 " + m + ") · 철도역 " + r[4].n + " · 인구 100m 격자";
    }).catch(function (e) {
      console.error(e);
      busy("자료를 불러오지 못했습니다: " + e.message + (location.protocol === "file:" ? " — 웹서버(preview.cmd)로 열어 주세요." : ""));
    });
    table();
  }

  /* ---------- 행정경계 + 시군 이름 ---------- */
  function drawBoundaries(sido, sig, emd) {
    layers.emd = L.geoJSON(emd, { pane: "emdPane", style: { color: "rgba(0,0,0,.24)", weight: 0.7, fill: false }, interactive: false }).addTo(map);
    layers.sig = L.geoJSON(sig, { pane: "sigPane", style: { color: "#232323", weight: 0.9, fill: false }, interactive: false }).addTo(map);
    layers.sido = L.geoJSON(sido, { pane: "sigPane", style: { color: "#232323", weight: 1.6, fill: false }, interactive: false }).addTo(map);
    /* 시군 이름 — 경계 상자의 가운데 (진한 회색) */
    layers.lsi = L.layerGroup();
    L.geoJSON(sig).eachLayer(function (l) {
      var c = l.getBounds().getCenter();
      L.tooltip({ permanent: true, direction: "center", className: "lbl lbl-si", pane: "lblPane", interactive: false })
        .setLatLng(c).setContent(l.feature.properties.name).addTo(layers.lsi);
    });
    layers.lsi.addTo(map);
  }

  /* ---------- 인구밀도 격자 ---------- */
  function drawPop(meta) {
    popMeta = meta;
    popImg = L.imageOverlay(D + "pop_density.png?v=" + VER, meta.bounds, { opacity: 0.85, pane: "popPane", interactive: false }).addTo(map);
    layers.pop = popImg;
    /* 500m 값 격자 — 눌렀을 때 그 자리의 밀도 */
    try {
      var g = meta.grid, bin = atob(g.u16_b64), n = bin.length / 2, arr = new Uint16Array(n);
      for (var i = 0; i < n; i++) arr[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      popGrid = { a: arr, g: g };
    } catch (e) { popGrid = null; }
  }
  function densityAt(latlng) {
    if (!popGrid) return null;
    var g = popGrid.g;
    var r = Math.floor((g.lat1 - latlng.lat) / g.dlat), c = Math.floor((latlng.lng - g.lon0) / g.dlon);
    if (r < 0 || c < 0 || r >= g.nrow || c >= g.ncol) return null;
    return popGrid.a[r * g.ncol + c];
  }
  function densityClass(v) {
    if (!v) return -1;
    var br = popMeta.breaks, k = -1;
    for (var i = 0; i < br.length; i++) if (v >= br[i]) k = i;
    return k;
  }

  /* ---------- 산단 경계 + 파란 이름 ---------- */
  function drawComplexes(fc) {
    layers.ldan = L.layerGroup();
    cxLayer = L.geoJSON(fc, {
      pane: "cxPane",
      style: function (f) {
        var p = f.properties;
        return { color: "#232323", weight: 0.8, fillColor: ageColor(p.matched ? p.age : null), fillOpacity: 1 };
      },
      onEachFeature: function (f, l) {
        var p = f.properties;
        cxIndex.push({ p: p, geom: f.geometry, layer: l });
        l.on("click", function (e) { L.DomEvent.stop(e); if (measuring) { addMeasure(e.latlng); return; } showComplex(p, l); });
        if (p.lat && p.lon) {
          L.tooltip({ permanent: true, direction: "center", className: "lbl lbl-dan", pane: "lblPane", interactive: false })
            .setLatLng([p.lat, p.lon]).setContent(p.name).addTo(layers.ldan);
        }
      },
    }).addTo(map);
    layers.cx = cxLayer;
    layers.ldan.addTo(map);
  }
  function showComplex(p, l) {
    highlight(l);
    var ageTxt = p.matched && p.age != null ? p.age + "년 (지정 " + esc(p.desig) + ")" : "목록과 짝이 안 맞아 모름";
    side.innerHTML =
      '<h4><span class="dot" style="display:inline-block;width:11px;height:11px;border-radius:2px;border:1px solid #232323;background:' + ageColor(p.matched ? p.age : null) + '"></span> ' + esc(p.name) + "</h4>" +
      '<p class="sub">' + esc(p.lname || "(목록 이름 없음)") + "</p>" +
      '<div class="ag-kv">' +
        "<b>유형</b><span>" + esc(p.type || "—") + "</span>" +
        "<b>노후년도</b><span>" + ageTxt + "</span>" +
        "<b>조성</b><span>" + esc(p.status || "—") + "</span>" +
        "<b>면적</b><span>" + (p.area ? num(Math.round(p.area / 10000)) + " ha" : "—") + "</span>" +
        "<b>가장 가까운 역</b><span>" + esc(p.near_st) + " · " + (p.near_m < 1000 ? p.near_m + " m" : (p.near_m / 1000).toFixed(1) + " km") + " (경계까지 직선)</span>" +
        (p.where ? "<b>위치</b><span>" + esc(p.where) + "</span>" : "") +
        (p.n_list > 1 ? "<b>목록 줄</b><span>" + p.n_list + "줄이 이 경계에 붙음</span>" : "") +
      "</div>" +
      '<p class="ag-hint">가까운 역을 누르면 반경 안 산단이 나옵니다.</p>';
  }
  var hi = null;
  function highlight(l) {
    if (hi) { try { hi.setStyle({ weight: 0.8, color: "#232323" }); } catch (e) {} }
    hi = l;
    if (l) { l.setStyle({ weight: 2.6, color: "#0ea5e9" }); if (l.bringToFront) l.bringToFront(); }
  }

  /* ---------- 도시쇠퇴도 8유형 (행정동) ---------- */
  function drawDecline(fc) {
    if (!fc) { var cb = document.getElementById("ag-l-dec"); if (cb) { cb.checked = false; cb.disabled = true; } return; }
    decMeta = fc.meta || {};
    layers.dec = L.geoJSON(fc, {
      pane: "decPane",
      style: function (f) { return { color: "rgba(0,0,0,.15)", weight: 0.4, fillColor: f.properties.color || "#999", fillOpacity: 0.5 }; },
      onEachFeature: function (f, l) {
        var p = f.properties;
        l.bindTooltip(esc([p.si, p.sgg, p.emd].filter(Boolean).join(" ")) + " · " + esc(p.class_8) + (p.weight != null ? " (가중치 " + p.weight + ")" : ""), { sticky: true, className: "lbl-st" });
        l.on("click", function (e) {
          L.DomEvent.stop(e);
          if (measuring) { addMeasure(e.latlng); return; }
          side.innerHTML = "<h4><i style=\"display:inline-block;width:11px;height:11px;border:1px solid rgba(0,0,0,.3);vertical-align:-1px;background:" + esc(p.color) + "\"></i> " + esc([p.si, p.sgg, p.emd].filter(Boolean).join(" ")) + "</h4>" +
            '<p class="sub">도시쇠퇴도 8유형</p><div class="ag-kv">' +
            "<b>유형</b><span>" + esc(p.class_8) + (p.class_3 && p.class_3 !== p.class_8 ? " (3유형: " + esc(p.class_3) + ")" : "") + "</span>" +
            "<b>전환 활용 가중치</b><span>" + (p.weight != null ? p.weight : "—") + "</span>" +
            "<b>인구 (최대 대비)</b><span>" + (p.pop_to_max != null ? Math.round(p.pop_to_max * 100) + "%" : "—") + "</span>" +
            "<b>사업체 (최대 대비)</b><span>" + (p.busi_to_max != null ? Math.round(p.busi_to_max * 100) + "%" : "—") + "</span>" +
            "<b>20년 이상 건물 비율</b><span>" + (p.old_bd20r != null ? Math.round(p.old_bd20r * 100) + "%" : "—") + "</span></div>" +
            '<p class="ag-hint">인구·사업체는 그 동의 최대치 대비 지금 값(1 에 가까울수록 유지). 도시쇠퇴도는 인구감소·사업체감소·노후건축물 세 지표의 조합입니다.</p>';
        });
      },
    }).addTo(map);
  }

  /* ---------- 토지특성 — 공업 용도지역 ---------- */
  function drawIndustrial(fc) {
    var cb = document.getElementById("ag-l-ind"), n = document.getElementById("ag-l-ind-n");
    if (!fc) { if (cb) { cb.checked = false; cb.disabled = true; } if (n) n.textContent = "(준비 중)"; return; }
    indMeta = fc.meta || {};
    layers.ind = L.geoJSON(fc, {
      pane: "indPane",
      style: function (f) { return { color: "#a16207", weight: 0.6, fillColor: f.properties.color || "#e8b450", fillOpacity: 0.6 }; },
      onEachFeature: function (f, l) {
        var p = f.properties, nm = p.name || p.zone || p["용도지역"] || p["용도지역명"] || "공업지역";
        l.bindTooltip(esc(nm) + (p.area_ha ? " · " + num(Math.round(p.area_ha)) + " ha" : ""), { sticky: true, className: "lbl-st" });
      },
    }).addTo(map);
    if (n) n.textContent = "(" + fc.features.length + ")";
  }

  /* ---------- 역세권 1km 버퍼(원) — 역마다 1,000m ---------- */
  function drawBuffer(doc) {
    layers.buf = L.layerGroup();
    doc.items.forEach(function (s) {
      L.circle([s.lat, s.lon], { pane: "bufPane", radius: 1000, color: "#5b8fbf", weight: 0.8, fillColor: "#c6dbef", fillOpacity: 0.35, interactive: false }).addTo(layers.buf);
    });
    layers.buf.addTo(map);
  }

  /* ---------- 역세권 1km 안 산단 영역 (분석 세션 결과) ---------- */
  function drawZone(fc) {
    if (!fc) return;
    layers.zone = L.geoJSON(fc, {
      pane: "zonePane", style: ZONE,
      onEachFeature: function (f, l) {
        var p = f.properties;
        l.bindTooltip(esc(p.DAN_NAME) + " · 역세권 안 " + num(p["역세권면적_ha"]) + " ha (" + Math.round(p["역세권비율"] * 100) + "%)<br>" + esc(p["역세권_역"]), { sticky: true, className: "lbl-st" });
      },
    }).addTo(map);
  }

  /* ---------- 역 ---------- */
  function drawStations(doc) {
    stations = doc.items;
    layers.st = L.layerGroup();
    stations.forEach(function (s) {
      var o = L.circleMarker([s.lat, s.lon], { pane: "stPane", radius: 5, color: "#000", weight: 1.3, fillColor: "#fff", fillOpacity: 1 });
      var i = L.circleMarker([s.lat, s.lon], { pane: "stPane", radius: 1.7, color: "#000", weight: 0, fillColor: "#000", fillOpacity: 1, interactive: false });
      o.bindTooltip(esc(s.name) + "역" + (s.lines ? " · " + esc(s.lines) : "") + (s.gtx ? " · GTX " + esc(s.gtx) : ""), { direction: "top", offset: [0, -6], className: "lbl-st" });
      o.on("click", function (e) { L.DomEvent.stop(e); if (measuring) { addMeasure(e.latlng); return; } stationZone(s); });
      o.addTo(layers.st); i.addTo(layers.st);
      stMarks.push(o);
    });
    layers.st.addTo(map);
  }

  /* 역세권 — 반경 안에 걸치는 산단 */
  function stationZone(s) {
    var c = [s.lat, s.lon];
    if (ring) { map.removeLayer(ring); ring = null; }
    if (ringDash) { map.removeLayer(ringDash); ringDash = null; }
    ring = L.circle(c, { radius: radius, color: "#0ea5e9", weight: 2, fillColor: "#0ea5e9", fillOpacity: 0.08, interactive: false }).addTo(map);
    if (radius > 500) ringDash = L.circle(c, { radius: 500, color: "#0ea5e9", weight: 1, dashArray: "4 4", fill: false, interactive: false }).addTo(map);
    var hits = [];
    cxIndex.forEach(function (x) {
      var d = polyDist(c, x.geom);
      if (d <= radius) hits.push({ x: x, d: Math.round(d) });
    });
    hits.sort(function (a, b) { return a.d - b.d || (b.x.p.age || 0) - (a.x.p.age || 0); });
    var old = hits.filter(function (h) { return h.x.p.age != null && h.x.p.age >= 30; }).length;
    side.innerHTML =
      "<h4>◉ " + esc(s.name) + "역</h4>" +
      '<p class="sub">' + esc(s.lines || "") + (s.gtx ? " · GTX " + esc(s.gtx) : "") + (s.sgg ? " · " + esc(s.sgg) : "") + "</p>" +
      '<div class="ag-kv"><b>반경</b><span>' + (radius >= 1000 ? (radius / 1000) + " km" : radius + " m") + " (직선)</span>" +
      "<b>걸치는 산단</b><span>" + hits.length + "곳" + (old ? " · 30년 이상 " + old + "곳" : "") + "</span></div>" +
      (hits.length ? '<ul class="ag-list">' + hits.map(function (h, i) {
        var p = h.x.p, a = p.matched ? p.age : null;
        return '<li data-i="' + i + '"><span class="nm">' + esc(p.name) + (p.lname && p.lname !== p.name ? '<br><small style="color:#8b8280">' + esc(p.lname.split(" / ")[0]) + "</small>" : "") + "</span>" +
          '<span class="age" style="background:' + (a == null ? UNMATCHED : (a >= 30 ? "#a31c1c" : a >= 15 ? "#c57171" : "#b9a6a6")) + '">' + (a == null ? "?" : a + "년") + "</span>" +
          '<span class="km">' + (h.d === 0 ? "역이 안에" : h.d + " m") + "</span></li>";
      }).join("") + "</ul>" : '<p class="ag-hint">이 반경 안에 걸치는 산단이 없습니다. 반경을 키워 보세요.</p>') +
      '<p class="ag-hint" style="margin-top:.6rem">거리는 역에서 산단 경계까지의 직선거리입니다. 목록을 누르면 그 산단으로 갑니다.</p>';
    side.querySelectorAll("li[data-i]").forEach(function (li) {
      li.addEventListener("click", function () {
        var h = hits[+li.dataset.i];
        highlight(h.x.layer);
        map.fitBounds(h.x.layer.getBounds().extend(c), { padding: [30, 30], maxZoom: 14 });
      });
    });
    map.fitBounds(ring.getBounds(), { padding: [20, 20] });
  }

  /* ---------- 거리 재기 ---------- */
  function setMeasuring(on) {
    measuring = on;
    document.body.classList.toggle("measuring", on);
    var b = document.getElementById("ag-measure");
    b.classList.toggle("active", on);
    b.textContent = on ? "📏 재는 중 — 두 번 누르면 끝" : "📏 재기 시작";
    if (on) { clearMeasure(); side.innerHTML = "<h4>📏 거리 재기</h4><p class=\"ag-hint\">지도를 차례로 누르세요. 점마다 누적 거리가 붙고, 두 번 누르면 끝납니다.</p>"; }
  }
  function clearMeasure() {
    mPts = [];
    if (mLine) { map.removeLayer(mLine); mLine = null; }
    mTips.forEach(function (t) { map.removeLayer(t); }); mTips = [];
  }
  function addMeasure(latlng) {
    mPts.push(latlng);
    if (!mLine) mLine = L.polyline(mPts, { color: "#1c1a19", weight: 2, dashArray: "6 4", interactive: false }).addTo(map);
    else mLine.setLatLngs(mPts);
    var total = 0;
    for (var i = 1; i < mPts.length; i++) total += dist(mPts[i - 1], mPts[i]);
    var seg = mPts.length > 1 ? dist(mPts[mPts.length - 2], mPts[mPts.length - 1]) : 0;
    var txt = mPts.length === 1 ? "시작" : fmtM(total) + (mPts.length > 2 ? " (이 구간 " + fmtM(seg) + ")" : "");
    var t = L.tooltip({ permanent: true, direction: "right", offset: [8, 0], className: "ag-ruler", interactive: false }).setLatLng(latlng).setContent(txt).addTo(map);
    mTips.push(t);
    mTips.push(L.circleMarker(latlng, { radius: 3, color: "#1c1a19", fillColor: "#fff", fillOpacity: 1, weight: 1.5, interactive: false }).addTo(map));
    side.innerHTML = "<h4>📏 거리 재기</h4>" +
      '<div class="ag-kv"><b>점</b><span>' + mPts.length + "개</span><b>모두</b><span>" + fmtM(total) + "</span>" + (mPts.length > 1 ? "<b>마지막 구간</b><span>" + fmtM(seg) + "</span>" : "") + "</div>" +
      '<p class="ag-hint">직선거리(구면)입니다. 두 번 누르면 끝나고, 「지우기」 로 지웁니다.</p>';
  }
  function fmtM(m) { return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(2) + " km"; }

  /* ---------- 빈 곳 클릭 — 인구밀도 ---------- */
  function showDensity(latlng) {
    var v = densityAt(latlng);
    var k = v == null ? -1 : densityClass(v);
    side.innerHTML = "<h4>이 자리의 인구밀도</h4>" +
      '<div class="ag-kv"><b>밀도</b><span>' + (v == null ? "자료 밖" : v ? "약 " + num(v) + " " + popMeta.unit.split(" ")[0] : "0 (사람 없음)") + "</span>" +
      "<b>급간</b><span>" + (k >= 0 ? '<i style="display:inline-block;width:11px;height:11px;border:1px solid rgba(0,0,0,.3);vertical-align:-1px;background:' + popMeta.colors[k] + '"></i> ' + popMeta.labels[k] : "—") + "</span>" +
      "<b>위치</b><span>" + latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5) + "</span></div>" +
      '<p class="ag-hint">약 500m 칸의 평균값입니다(그림은 100m 격자). 역을 누르면 반경 안 산단이, 산단을 누르면 노후년도가 나옵니다.</p>';
  }

  /* ---------- 범례 ---------- */
  function legend() {
    var el = document.getElementById("ag-legend0");
    var decLeg = "";
    if (decMeta && decMeta["색"]) {
      var cnt = decMeta["유형수"] || {}, w = decMeta["가중치"] || {};
      var order = Object.keys(decMeta["색"]).sort(function (a, b) { return (w[b] || 0) - (w[a] || 0) || (cnt[b] || 0) - (cnt[a] || 0); });
      decLeg = "<b>③ 도시쇠퇴도 8유형 (행정동 · 가중치)</b>" +
        order.map(function (k) { return '<span><i style="background:' + decMeta["색"][k] + ';opacity:.85"></i>' + esc(k.replace("지역", "")) + "<em>" + (w[k] != null ? w[k] : "") + (cnt[k] ? " · " + cnt[k] + "동" : "") + "</em></span>"; }).join("");
    }
    var indLeg = "";
    if (indMeta) {
      var cols = indMeta["색"] || indMeta.colors || { "공업 용도지역": "#e8b450" };
      indLeg = "<b>④ 토지특성 — 공업 용도지역</b>" + Object.keys(cols).map(function (k) { return '<span><i style="background:' + cols[k] + ';opacity:.8"></i>' + esc(k) + "</span>"; }).join("");
    }
    el.innerHTML = "<h4>범례 <button type=\"button\" class=\"ag-legend__t\" id=\"ag-legend-t\" title=\"범례 접기/펴기\" style=\"float:right\">▾ 접기</button></h4>" +
      "<b>① 노후년도 (2026 − 지정 연도)</b>" +
      AGE_CLASSES.map(function (c) { return '<span><i style="background:' + c[2] + '"></i>' + c[0] + " – " + (c[1] === 63 ? 62 : c[1]) + "</span>"; }).join("") +
      '<span><i style="background:' + UNMATCHED + '"></i>목록과 짝 없음</span>' +
      '<span><i class="zone"></i>역세권 1km 안 산단 영역</span>' +
      "<b>② 인구밀도 (명/㎢, 100m 격자)</b>" +
      popMeta.colors.map(function (c, i) { return '<span><i style="background:' + c + '"></i>' + popMeta.labels[i] + "</span>"; }).join("") +
      decLeg + indLeg +
      "<b>역세권 · 역</b>" +
      '<span><i class="buf"></i>역세권 1km 버퍼(원)</span>' +
      '<span><i class="st"></i>철도역</span>';
    document.getElementById("ag-legend-t").addEventListener("click", function () {
      var off = el.classList.toggle("folded");
      this.textContent = off ? "▸ 펴기" : "▾ 접기";
    });
  }

  /* ---------- 단추·체크 ---------- */
  function wire() {
    var on = function (id, fn) { var el = document.getElementById(id); if (el) el.addEventListener("change", function () { fn(el.checked); }); };
    var tog = function (layer, show) { if (!layer) return; if (show) layer.addTo(map); else map.removeLayer(layer); };
    on("ag-l-cx", function (v) { tog(layers.cx, v); document.getElementById("ag-map0").classList.toggle("no-dan", !v || !document.getElementById("ag-l-ldan").checked); });
    on("ag-l-zone", function (v) { tog(layers.zone, v); });
    on("ag-l-dec", function (v) { tog(layers.dec, v); });
    on("ag-l-ind", function (v) { tog(layers.ind, v); });
    on("ag-l-buf", function (v) { tog(layers.buf, v); });
    on("ag-l-st", function (v) { tog(layers.st, v); });
    on("ag-l-pop", function (v) { tog(layers.pop, v); });
    on("ag-l-emd", function (v) { tog(layers.emd, v); });
    on("ag-l-lsi", function (v) { document.getElementById("ag-map0").classList.toggle("no-si", !v); });
    on("ag-l-ldan", function (v) { document.getElementById("ag-map0").classList.toggle("no-dan", !v); });
    on("ag-l-base", function (v) {
      if (v && !base) base = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri · HERE · OpenStreetMap contributors" });
      if (v) { base.addTo(map); base.bringToBack(); } else if (base) map.removeLayer(base);
    });
    document.querySelectorAll("[data-r]").forEach(function (b) {
      b.addEventListener("click", function () {
        radius = +b.dataset.r;
        document.querySelectorAll("[data-r]").forEach(function (x) { x.classList.toggle("active", x === b); });
        if (ring) { var c = ring.getLatLng(); var s = nearestStation(c); if (s) stationZone(s); }
      });
    });
    document.getElementById("ag-measure").addEventListener("click", function () { setMeasuring(!measuring); });
    document.getElementById("ag-clear").addEventListener("click", function () {
      setMeasuring(false); clearMeasure();
      if (ring) { map.removeLayer(ring); ring = null; }
      if (ringDash) { map.removeLayer(ringDash); ringDash = null; }
      highlight(null);
      side.innerHTML = "<h4>역세권 · 거리</h4><p class=\"ag-hint\">역을 누르면 반경 안 산단이 여기에 나옵니다. 산단을 누르면 노후년도와 가장 가까운 역이, 빈 곳을 누르면 그 자리의 인구밀도가 나옵니다.</p>";
    });
    map.on("click", function (e) {
      if (measuring) { addMeasure(e.latlng); return; }
      showDensity(e.latlng);
    });
    map.on("dblclick", function (e) { if (measuring) { L.DomEvent.stop(e); setMeasuringDone(); } });
  }
  function setMeasuringDone() {
    measuring = false; document.body.classList.remove("measuring");
    var b = document.getElementById("ag-measure"); b.classList.remove("active"); b.textContent = "📏 재기 시작";
  }
  function nearestStation(c) {
    var best = null, bd = Infinity;
    stations.forEach(function (s) { var d = dist(c, [s.lat, s.lon]); if (d < bd) { bd = d; best = s; } });
    return best;
  }

  /* ---------- 그림 확대 (라이트박스) — .ag-zoom 그림 누르면 ---------- */
  function lightbox() {
    var lb = document.getElementById("ag-lb"), img = document.getElementById("ag-lb-img"), cap = document.getElementById("ag-lb-cap");
    if (!lb) return;
    var sc = 1, tx = 0, ty = 0, drag = null;
    var apply = function () { img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + sc + ")"; };
    var fit = function () {
      var W = lb.clientWidth, H = lb.clientHeight, w = img.naturalWidth || 1, h = img.naturalHeight || 1;
      sc = Math.min((W - 40) / w, (H - 80) / h, 1); tx = (W - w * sc) / 2; ty = (H - h * sc) / 2; apply();
    };
    var open = function (src, text) {
      cap.textContent = text || ""; lb.classList.add("on"); document.body.style.overflow = "hidden";
      img.onload = fit; img.src = src; if (img.complete) fit();
    };
    var close = function () { lb.classList.remove("on"); document.body.style.overflow = ""; };
    document.querySelectorAll("img.ag-zoom").forEach(function (im) {
      im.addEventListener("click", function () { var f = im.closest("figure"); open(im.currentSrc || im.src, f && f.querySelector("figcaption") ? f.querySelector("figcaption").textContent : im.alt); });
    });
    document.getElementById("ag-lb-x").addEventListener("click", close);
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && lb.classList.contains("on")) close(); });
    lb.addEventListener("wheel", function (e) {
      e.preventDefault();
      var k = e.deltaY < 0 ? 1.15 : 1 / 1.15, ns = Math.max(0.2, Math.min(12, sc * k));
      /* 마우스 자리를 기준으로 확대 */
      tx = e.clientX - (e.clientX - tx) * (ns / sc); ty = e.clientY - (e.clientY - ty) * (ns / sc); sc = ns; apply();
    }, { passive: false });
    img.addEventListener("mousedown", function (e) { e.preventDefault(); drag = { x: e.clientX - tx, y: e.clientY - ty }; img.classList.add("drag"); });
    window.addEventListener("mousemove", function (e) { if (!drag) return; tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); });
    window.addEventListener("mouseup", function () { drag = null; img.classList.remove("drag"); });
    img.addEventListener("dblclick", fit);
    /* 손가락 — 끌기만 (핀치는 브라우저 기본) */
    img.addEventListener("touchstart", function (e) { if (e.touches.length === 1) drag = { x: e.touches[0].clientX - tx, y: e.touches[0].clientY - ty }; }, { passive: true });
    img.addEventListener("touchmove", function (e) { if (drag && e.touches.length === 1) { tx = e.touches[0].clientX - drag.x; ty = e.touches[0].clientY - drag.y; apply(); } }, { passive: true });
    img.addEventListener("touchend", function () { drag = null; });
  }

  /* ---------- ② 역세권 1km 안 산단 표 ---------- */
  var rows = [], sortK = "역세권면적_ha", sortDir = -1;
  function table() {
    getJSON(D + "analysis/station_1km_summary.json").then(function (doc) {
      var m = doc.meta || {};
      rows = (doc.items || []).filter(function (r) { return r["역세권면적_ha"] > 0; });
      document.getElementById("ag-tbl-src").textContent = "역세권 1km 안 산단 " + rows.length + "곳 / " + (m["산단수"] || "") + " · 작성 " + (m["작성"] || "");
      document.getElementById("ag-stat").innerHTML =
        "<div><b>" + rows.length + "곳</b><span>역세권(1km)에 걸치는 산단 / " + (m["산단수"] || "—") + "</span></div>" +
        "<div><b>" + num(Math.round(m["역세권포함면적_ha"] || 0)) + " ha</b><span>역세권 안 산단 면적 합</span></div>" +
        "<div><b>" + ((m["역세권비율_전체"] || 0) * 100).toFixed(1) + "%</b><span>전체 산단 면적 " + num(Math.round(m["전체산단면적_ha"] || 0)) + " ha 가운데</span></div>" +
        "<div><b>" + (m["GTX역세권산단수"] == null ? "—" : m["GTX역세권산단수"] + "곳") + "</b><span>GTX 역세권(1km) 산단</span></div>";
      drawTable();
      document.querySelectorAll("#ag-tbl th button").forEach(function (b) {
        b.addEventListener("click", function () {
          var k = b.dataset.k;
          if (sortK === k) sortDir = -sortDir; else { sortK = k; sortDir = (k === "DAN_NAME" || k === "단지유형" || k === "역세권_역") ? 1 : -1; }
          drawTable();
        });
      });
    }).catch(function (e) {
      document.getElementById("ag-tbl-src").textContent = "표 자료를 불러오지 못했습니다 — " + e.message;
    });
  }
  function drawTable() {
    var L2 = rows.slice().sort(function (a, b) {
      var x = a[sortK], y = b[sortK];
      if (typeof x === "string" || typeof y === "string") return String(x || "").localeCompare(String(y || ""), "ko") * sortDir;
      return ((x || 0) - (y || 0)) * sortDir;
    });
    document.getElementById("ag-tbody").innerHTML = L2.map(function (r) {
      var a = r["노후년도"];
      return "<tr>" +
        "<td><b>" + esc(r.DAN_NAME) + "</b>" + (r["단지명"] && r["단지명"] !== r.DAN_NAME ? '<br><small style="color:#8b8280">' + esc(r["단지명"]) + "</small>" : "") + "</td>" +
        "<td>" + esc(r["단지유형"] || "") + "</td>" +
        '<td class="n"><span style="display:inline-block;width:10px;height:10px;border:1px solid #232323;vertical-align:-1px;margin-right:.3rem;background:' + ageColor(a) + '"></span>' + (a == null ? "—" : a) + "</td>" +
        '<td class="n">' + num(Math.round(r["산단면적_ha"] || 0)) + "</td>" +
        '<td class="n">' + num(Math.round(r["역세권면적_ha"] || 0)) + "</td>" +
        '<td class="n">' + Math.round((r["역세권비율"] || 0) * 100) + "%</td>" +
        "<td>" + esc(r["역세권_역"] || "") + (r["GTX역세권"] ? ' <span class="tag-out">GTX</span>' : "") + "</td>" +
        "<td>" + esc(r["최근접역"] || "") + (r["최근접역거리_m"] != null ? ' <span style="color:#8b8280">' + (r["최근접역거리_m"] === 0 ? "안에" : num(Math.round(r["최근접역거리_m"])) + " m") + "</span>" : "") + "</td>" +
      "</tr>";
    }).join("");
    document.querySelectorAll("#ag-tbl th").forEach(function (th) {
      var b = th.querySelector("button"); if (!b) return;
      var on = b.dataset.k === sortK; th.classList.toggle("on", on);
      var a = b.querySelector(".arr"); if (!a) { a = document.createElement("span"); a.className = "arr"; b.appendChild(a); }
      a.textContent = on ? (sortDir > 0 ? "▲" : "▼") : "↕";
      b.title = on ? "다시 누르면 반대 방향" : "이 칸으로 줄 세우기";
    });
    document.getElementById("ag-tbl-note").textContent = "역세권 내 면적이 큰 차례(누르면 바뀜). 비율 = 역세권 내 면적 ÷ 산단 면적. 거리는 산단 경계에서 역까지의 직선거리이고 0은 역이 경계 안에 있다는 뜻입니다.";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
