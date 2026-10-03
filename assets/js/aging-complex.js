/* =============================================================
   [경기도 노후 산업단지 — 활용 방향] — aging-complex.html  · 지도와 표

   ② 큰 지도 : 산단 경계(노후년도 10급간 붉은색) × 철도역 × 인구밀도 격자 × 도시쇠퇴도 × 공업 용도지역 × A·B 등급
               · 역을 누르면 반경(500m~2km) 안 산단을 세고, 「거리 재기」 로 두 점 사이를 잽니다
               · 시군 이름은 진한 회색, 산단 이름은 파란색 — QGIS 화면(GG_노후산단분석.qgz)과 같게
   ③④⑤⑥ 작은 지도 : data-mini 자리에 틀을 짜 넣고, 화면에 들어올 때 그립니다 (처음 열 때 가볍게)
   표       : sortTable() 하나로 — 머리글 .fb-sort + aria-sort (반지하·방산 화면과 같은 정렬 모양)
   차트     : aging-charts.js 가 window.AG 를 씁니다 (자료 읽기 · 색 · 「지도에서 보기」)

   자료 : assets/data/aging/*.json · pop_density.png (tools/aging/build_aging.py 가 만듭니다)
          assets/data/aging/analysis/* (산단 분석 세션이 만든 결과)
   ============================================================= */
(function () {
  "use strict";
  var D = "assets/data/aging/";
  var VER = "202609182230";                              // 자료를 다시 만들면 올립니다 (브라우저가 옛 파일을 쓰지 않게)
  var GG_CENTER = [37.42, 127.05], GG_ZOOM = 9;
  var DAN_ZOOM = 10;                                     // 산단 이름은 이 줌부터
  /* QGIS 등급 색 그대로 (노후년도 0~62, 10급간) — 0~6 만 흰색 대신 아주 옅은 붉은색:
     흰 바탕에서는 새 산단이 있는지 안 보였습니다 */
  var AGE_CLASSES = [
    [0, 6, "#fbecec"], [6, 11, "#f3e3e3"], [11, 15, "#e8c6c6"], [15, 19, "#dcaaaa"], [19, 26, "#d18e8e"],
    [26, 32, "#c57171"], [32, 36, "#ba5555"], [36, 42, "#ae3939"], [42, 53, "#a31c1c"], [53, 63, "#970000"],
  ];
  var UNMATCHED = "#8f9a9e";
  var ZONE = { color: "#634b4f", fillColor: "#821e32", fillOpacity: 0.55, weight: 1 };
  var GRADE_COLOR = { A: "#821e32", B: "#c88278", C: "#ebbd79", D: "#707070" };   // 「색깔파레트31」 안에서 — 자료(grade_area.json)의 색보다 앞섬
  var PICK = "#00a4ce";                                                              // 고른 산단·역 반경
  var GRADE_TXT = { A: "전환 우선", B: "복합화", C: "고도화 유지", D: "보호·게이트" };
  var SIDE_HINT = "<h4>역세권 · 거리</h4><p class=\"ag-hint\">역을 누르면 반경 안 산단이 여기에 나옵니다. 산단을 누르면 노후년도·가장 가까운 역·등급, 행정동을 누르면 쇠퇴 유형, 빈 곳을 누르면 그 자리의 인구밀도가 나옵니다.</p>";

  /* ---------- 작은 손잡이 ---------- */
  var num = function (n) { return Number(n).toLocaleString("ko-KR"); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  };
  var $ = function (id) { return document.getElementById(id); };
  var sw = function (color, extra) { return '<i class="ag-sw" style="background:' + esc(color) + (extra ? ";" + extra : "") + '"></i>'; };
  var pc = function (v) { return v == null || v === "" ? "—" : Math.round(v * 100) + "%"; };
  var fmtM = function (m) { return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(2) + " km"; };
  var mute = function (s) { return ' <span class="ag-mute">' + s + "</span>"; };
  function ageColor(a) {
    if (a == null) return UNMATCHED;
    for (var i = AGE_CLASSES.length - 1; i >= 0; i--) if (a >= AGE_CLASSES[i][0]) return AGE_CLASSES[i][2];
    return AGE_CLASSES[0][2];
  }
  /* 같은 파일은 한 번만 받습니다 — 지도·표·차트가 나눠 씀 */
  var cache = {};
  function getJSON(u) {
    if (!cache[u]) cache[u] = fetch(u + "?v=" + VER).then(function (r) { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
    return cache[u];
  }
  var opt = function (p) { return p.catch(function () { return null; }); };
  /* 화면에 들어올 때 한 번 — 무거운 작은 지도를 늦게 그림 */
  function whenVisible(el, fn) {
    if (!("IntersectionObserver" in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: "300px 0px" });
    io.observe(el);
  }

  /* ---------- 거리 ---------- */
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
  function inRing(p, ring) {                         // ray casting, ring = [[lon,lat],…]
    var x = p[1], y = p[0], inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  /* 점에서 폴리곤 경계까지 최단거리(m) — 안에 있으면 0 */
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

  /* ---------- ⑤ 자료 손잡이 — RK 는 unit_id 로 찾는 표 (산단은 "D_" + complexes.id) ---------- */
  var RK = {};
  var gradeChip = function (g) { return g ? '<span class="ag-grade' + (g === "C" ? " ag-grade--C" : "") + '" style="background:' + (GRADE_COLOR[g] || "#999") + '">' + esc(g) + "</span>" : "—"; };
  /* 0단계 전제(산업체 감소) — 미충족은 회색 「산업 유지」, 게이트는 옅은 글자, 충족은 초록 */
  var reasonChip = function (r) {
    var s = (r && r["판정사유"]) || ""; if (!s) return "—";
    if (s.indexOf("미충족") >= 0) return '<span class="ag-keep" title="' + esc(s) + '">산업 유지</span>';
    if (s.indexOf("게이트") === 0) return '<span class="ag-gate" title="' + esc(s) + '">게이트</span>';
    return '<span class="ag-ok" title="' + esc(s) + '">전제 충족</span>';
  };
  var declRate = function (r) { return r && r.busi_decline != null ? "↓" + Math.round(r.busi_decline * 100) + "%" : ""; };
  /* v6 미분양 — 「산단 자체 / 같은 시군 산단 전체(공고면적 가중)」. 공고면적이 없으면 「–」 */
  var unsold = function (r) { return [r.unsold_ratio, r.sgg_unsold_ratio].map(function (v) { return v == null ? "–" : Math.round(v * 100) + "%"; }); };
  var hasUnsold = function (r) { return r && (r.unsold_ratio != null || r.sgg_unsold_ratio != null); };
  var unsoldTxt = function (r) { if (!hasUnsold(r)) return "—"; var u = unsold(r); return u[0] + '<small class="dn">/' + u[1] + "</small>"; };
  var unsoldRow = function (r) { if (!hasUnsold(r)) return ""; var u = unsold(r); return " · 미분양 " + u[0] + " / 시군 " + u[1]; };
  var declTxt = function (r) { return esc((r.decl_class || "—").replace("지역", "")) + (r.busi_decline != null ? ' <small class="dn">(' + declRate(r) + ")</small>" : ""); };
  var preTxt = function (rk) { return reasonChip(rk) + (rk.busi_decline != null ? " · 사업체 " + declRate(rk) : "") + unsoldRow(rk); };
  var rankRow = function (rk) { return rk ? "<b>전환 우선순위</b><span>" + gradeChip(rk["등급"]) + " " + rk["종합점수"] + "점 · " + preTxt(rk) + "</span>" + (rk["추천용도"] ? "<b>추천 용도</b><span>" + useChip(rk) + "</span>" : "") : ""; };
  var preRow = function (rk) { return rk ? "<b>0단계 전제</b><span>" + preTxt(rk) + "</span>" + (rk.decl_class ? "<b>쇠퇴유형</b><span>" + esc(rk.decl_class) + "</span>" : "") : ""; };
  /* 추천 용도 알약 — 「산업 유지(…미충족)」 은 판정 열과 겹치니 짧게 회색으로 */
  var useChip = function (r) { var u = r["추천용도"] || ""; if (!u) return "—"; return u.indexOf("산업 유지") === 0 ? '<span class="ag-use ag-use--keep" title="' + esc(u) + '">산업 유지</span>' : '<span class="ag-use">' + esc(u) + "</span>"; };
  /* 「주거/상업/업무」 세 비율을 한 칸에 — 예: 0%/1%/0% */
  var pct3 = function (a, b, c) { return (a == null && b == null && c == null) ? "—" : [a, b, c].map(function (v) { return v == null ? "–" : Math.round(v * 100) + "%"; }).join("/"); };
  var stTxt = function (r) { return r.nearest_station ? esc(r.nearest_station) + (r.dist_station_m != null ? mute(num(Math.round(r.dist_station_m)) + " m") : "") : "—"; };

  /* ---------- 정렬되는 표 하나 — cols: [{k, label, cell(r), num, small, desc, sort}] ----------
     머리글은 .fb-sort + aria-sort, 줄에 unit 이 있으면 누를 때 ② 지도로 */
  function sortTable(tblId, rows, cols, sortKey0, dir0, opts) {
    var tbl = $(tblId); if (!tbl) return;
    opts = opts || {};
    var sk = sortKey0, sd = dir0 || -1;
    var cmp = function (x, y) { return (typeof x === "string" || typeof y === "string") ? String(x).localeCompare(String(y), "ko") : x - y; };
    var draw = function () {
      var col = cols.filter(function (c) { return c.k === sk; })[0], vk = (col && col.sort) || sk;   // 값 열쇠 (열 열쇠와 다를 수 있음)
      var L2 = rows.slice().sort(function (a, b) {
        var x = a[vk], y = b[vk];
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        var c = cmp(x, y);
        if (!c && vk !== sk && a[sk] != null && b[sk] != null) c = cmp(a[sk], b[sk]);
        return c * sd;
      });
      tbl.querySelector("thead").innerHTML = "<tr>" + (opts.rank ? '<th class="n">순위</th>' : "") + cols.map(function (c) {
        var on = c.k === sk;
        return '<th scope="col"' + (c.num ? ' class="n"' : "") + (on ? ' aria-sort="' + (sd > 0 ? "ascending" : "descending") + '"' : "") + '><button type="button" class="fb-sort" data-k="' + esc(c.k) + '" title="' + (on ? "다시 누르면 반대 방향" : "이 칸으로 줄 세우기") + '">' + esc(c.label) + ' <span class="fb-sort__a">' + (on ? (sd > 0 ? "▲" : "▼") : "↕") + "</span></button></th>";
      }).join("") + "</tr>";
      tbl.querySelector("tbody").innerHTML = L2.map(function (r, i) {
        var u = opts.unit ? opts.unit(r) : null;
        return "<tr" + (u ? ' data-unit="' + esc(u) + '" title="눌러서 ② 지도에서 보기"' : "") + ">" + (opts.rank ? '<td class="n">' + (i + 1) + "</td>" : "") +
          cols.map(function (c) { return '<td class="' + (c.num ? "n" : (c.small ? "s" : "")) + '">' + c.cell(r) + "</td>"; }).join("") + "</tr>";
      }).join("");
      tbl.querySelectorAll(".fb-sort").forEach(function (b) {
        b.addEventListener("click", function () {
          var k = b.dataset.k, c = cols.filter(function (x) { return x.k === k; })[0];
          if (sk === k) sd = -sd; else { sk = k; sd = c && (c.num || c.desc) ? -1 : 1; }
          draw();
        });
      });
    };
    if (!tbl.dataset.wired) {
      tbl.dataset.wired = "1";
      tbl.querySelector("tbody").addEventListener("click", function (e) {
        var tr = e.target.closest("tr[data-unit]"); if (tr) focusUnit(tr.dataset.unit);
      });
    }
    draw();
  }

  /* ---------- ② 큰 지도 ---------- */
  var map, base = null, layers = {}, popMeta = null, popGrid = null, decMeta = null, indMeta = null, gradeMeta = null;
  var cxIndex = [], cxById = {}, stations = [];
  var radius = 1000, ring = null, ringDash = null, side;
  var measuring = false, mPts = [], mLine = null, mTips = [];

  function init() {
    side = $("ag-side");
    side.innerHTML = SIDE_HINT;
    map = L.map("ag-map0", { preferCanvas: true, scrollWheelZoom: true, doubleClickZoom: false, zoomSnap: 0.25 }).setView(GG_CENTER, GG_ZOOM);
    L.control.scale({ imperial: false }).addTo(map);
    window.__agMap = map;                                // 시험·디버그용 손잡이
    [["popPane", 250], ["decPane", 260], ["indPane", 270], ["bufPane", 280], ["emdPane", 300], ["sigPane", 310],
     ["cxPane", 400], ["zonePane", 410], ["gradePane", 415], ["stPane", 420], ["lblPane", 600]].forEach(function (p) {
      map.createPane(p[0]); map.getPane(p[0]).style.zIndex = p[1];   // 격자 맨 아래 → 등급 테두리는 산단 위·역 아래 → 이름표 맨 위
    });
    var box = $("ag-map0");
    var syncZoom = function () { box.classList.toggle("z-lo", map.getZoom() < DAN_ZOOM); };
    map.on("zoomend", syncZoom); syncZoom();

    busy("자료를 불러오는 중입니다…");
    Promise.all([
      getJSON(D + "sido.json"), getJSON(D + "sig.json"), getJSON(D + "emd.json"),
      getJSON(D + "complexes.json"), getJSON(D + "stations.json"), getJSON(D + "pop_meta.json"),
      opt(getJSON(D + "analysis/station_1km_area.json")),
      opt(getJSON(D + "analysis/decline_8class.json")),
      opt(getJSON(D + "analysis/industrial_zone.json")),
      opt(getJSON(D + "analysis/grade_area.json")),
      opt(getJSON(D + "analysis/residential_shift.json")),
    ]).then(function (r) {
      drawBoundaries(r[0], r[1], r[2]);
      fitGG(map, layers.sido.getBounds(), true);
      drawPop(r[5]);
      drawDecline(r[7]);
      drawIndustrial(r[8]);
      drawBuffer(r[4]);
      drawComplexes(r[3]);
      drawZone(r[6]);
      drawStations(r[4]);
      drawGrade(r[9]);
      legend();
      wire();
      miniMaps({ sig: r[1], cx: r[3], st: r[4], zone: r[6], dec: r[7], ind: r[8], grade: r[9], resid: r[10] });
      residential(r[10]);
      busy(null);
      var n = r[3].features.length, m = r[3].features.filter(function (f) { return f.properties.matched; }).length;
      $("ag-src").textContent = "산단 경계 " + n + "곳(목록 짝 " + m + ") · 철도역 " + r[4].n + " · 인구 100m 격자";
    }).catch(function (e) {
      console.error(e);
      busy("자료를 불러오지 못했습니다: " + e.message + (location.protocol === "file:" ? " — 웹서버(preview.cmd)로 열어 주세요." : ""));
    });
    lightbox();
    toc();
    stationTable();
    ranking();
  }
  function busy(msg) {
    var b = $("ag-busy0"); if (!b) return;
    if (msg == null) { b.hidden = true; return; }
    b.hidden = false; b.textContent = msg;
  }

  /* 경기도가 판에 꽉 차게 — 판 크기가 바뀌면(범례 접기·창 크기) 다시 맞춤.
     단, 맞춘 뒤 사용자가(또는 역·산단 누르기로) 화면을 옮겼으면 크기만 다시 셈 */
  function fitGG(m, bounds, watch) {
    var fitting = false, moved = false;
    m.on("movestart zoomstart", function () { if (!fitting) moved = true; });   // 손으로든 역·산단 누르기로든 옮기면
    var fit = function () { fitting = true; m.fitBounds(bounds, { padding: [12, 12], animate: false }); fitting = false; moved = false; };
    fit();
    if (watch && "ResizeObserver" in window) {
      var t; new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { m.invalidateSize(); if (!moved) fit(); }, 120); }).observe(m.getContainer());
    }
  }

  /* 행정경계 + 시군 이름 */
  function sigLabels(sig, pane, target) {
    L.geoJSON(sig).eachLayer(function (l) {
      L.tooltip({ permanent: true, direction: "center", className: "lbl lbl-si", pane: pane, interactive: false })
        .setLatLng(l.getBounds().getCenter()).setContent(l.feature.properties.name).addTo(target);
    });
  }
  function drawBoundaries(sido, sig, emd) {
    layers.emd = L.geoJSON(emd, { pane: "emdPane", style: { color: "rgba(0,0,0,.24)", weight: 0.7, fill: false }, interactive: false }).addTo(map);
    layers.sig = L.geoJSON(sig, { pane: "sigPane", style: { color: "#232323", weight: 0.9, fill: false }, interactive: false }).addTo(map);
    layers.sido = L.geoJSON(sido, { pane: "sigPane", style: { color: "#232323", weight: 1.6, fill: false }, interactive: false }).addTo(map);
    layers.lsi = L.layerGroup().addTo(map);
    sigLabels(sig, "lblPane", layers.lsi);
  }

  /* 인구밀도 격자 */
  function drawPop(meta) {
    popMeta = meta;
    layers.pop = L.imageOverlay(D + "pop_density.png?v=" + VER, meta.bounds, { opacity: 0.85, pane: "popPane", interactive: false }).addTo(map);
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

  /* 산단 경계 + 파란 이름 */
  function drawComplexes(fc) {
    layers.ldan = L.layerGroup();
    layers.cx = L.geoJSON(fc, {
      pane: "cxPane",
      style: function (f) { var p = f.properties; return { color: "#232323", weight: 0.8, fillColor: ageColor(p.matched ? p.age : null), fillOpacity: 1 }; },
      onEachFeature: function (f, l) {
        var p = f.properties, x = { p: p, geom: f.geometry, layer: l };
        cxIndex.push(x); cxById[p.id] = x;
        l.on("click", function (e) { L.DomEvent.stop(e); if (measuring) { addMeasure(e.latlng); return; } showComplex(p, l); });
        if (p.lat && p.lon) {
          L.tooltip({ permanent: true, direction: "center", className: "lbl lbl-dan", pane: "lblPane", interactive: false })
            .setLatLng([p.lat, p.lon]).setContent(p.name).addTo(layers.ldan);
        }
      },
    }).addTo(map);
    layers.ldan.addTo(map);
  }
  function showComplex(p, l) {
    highlight(l);
    var ageTxt = p.matched && p.age != null ? p.age + "년 (지정 " + esc(p.desig) + ")" : "목록과 짝이 안 맞아 모름";
    side.innerHTML =
      "<h4>" + sw(ageColor(p.matched ? p.age : null), "border-color:#232323") + esc(p.name) + "</h4>" +
      '<p class="sub">' + esc(p.lname || "(목록 이름 없음)") + "</p>" +
      '<div class="ag-kv">' +
        "<b>유형</b><span>" + esc(p.type || "—") + "</span>" +
        "<b>노후년도</b><span>" + ageTxt + "</span>" +
        "<b>조성</b><span>" + esc(p.status || "—") + "</span>" +
        "<b>면적</b><span>" + (p.area ? num(Math.round(p.area / 10000)) + " ha" : "—") + "</span>" +
        "<b>가장 가까운 역</b><span>" + esc(p.near_st) + " · " + (p.near_m < 1000 ? p.near_m + " m" : (p.near_m / 1000).toFixed(1) + " km") + " (경계까지 직선)</span>" +
        (p.where ? "<b>위치</b><span>" + esc(p.where) + "</span>" : "") +
        (p.ind3 ? "<b>유치업종 상위 3</b><span>" + esc(p.ind3) + (p.ind3_ha != null ? mute("(필지 " + num(p.ind3_ha) + " ha)") : "") + "</span>" : "") +
        (p.n_list > 1 ? "<b>목록 줄</b><span>" + p.n_list + "줄이 이 경계에 붙음</span>" : "") +
        (p.link ? "<b>경계 연결</b><span>" + esc(p.link) + "</span>" : "") +
        rankRow(RK["D_" + p.id]) +
      "</div>" +
      '<p class="ag-hint">가까운 역을 누르면 반경 안 산단이 나옵니다.</p>';
  }
  var hi = null;
  function highlight(l) {
    if (hi) { try { hi.setStyle({ weight: 0.8, color: "#232323" }); } catch (e) {} }
    hi = l;
    if (l) { l.setStyle({ weight: 2.6, color: PICK }); if (l.bringToFront) l.bringToFront(); }
  }
  /* 표·차트에서 「지도에서 보기」 — 산단은 경계로, 클러스터는 등급 폴리곤으로 */
  function focusUnit(uid) {
    if (!map || !uid) return;
    var f = $("fig2"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" });
    var go = function (l) { map.invalidateSize(); map.fitBounds(l.getBounds(), { padding: [40, 40], maxZoom: 14 }); };
    var x = uid.indexOf("D_") === 0 ? cxById[uid.slice(2)] : null;
    if (x) { if (!map.hasLayer(layers.cx)) { layers.cx.addTo(map); $("ag-l-cx").checked = true; } showComplex(x.p, x.layer); go(x.layer); return; }
    if (layers.grade) {
      layers.grade.eachLayer(function (l) {
        if (l.feature.properties.unit_id === uid) { if (!map.hasLayer(layers.grade)) { layers.grade.addTo(map); $("ag-l-grade").checked = true; } go(l); l.fire("click"); }
      });
    }
  }

  /* 도시쇠퇴도 8유형 (행정동) */
  var emdName = function (p) { return [p.si, p.sgg, p.emd].filter(Boolean).join(" "); };
  function disable(id, nId) { var cb = $(id), n = nId && $(nId); if (cb) { cb.checked = false; cb.disabled = true; } if (n) n.textContent = "(준비 중)"; }
  function drawDecline(fc) {
    if (!fc) { disable("ag-l-dec"); return; }
    decMeta = fc.meta || {};
    layers.dec = L.geoJSON(fc, {
      pane: "decPane",
      style: function (f) { return { color: "rgba(0,0,0,.15)", weight: 0.4, fillColor: f.properties.color || "#999", fillOpacity: 0.5 }; },
      onEachFeature: function (f, l) {
        var p = f.properties;
        l.bindTooltip(esc(emdName(p)) + " · " + esc(p.class_8) + (p.weight != null ? " (가중치 " + p.weight + ")" : ""), { sticky: true, className: "lbl-st" });
        l.on("click", function (e) {
          L.DomEvent.stop(e);
          if (measuring) { addMeasure(e.latlng); return; }
          side.innerHTML = "<h4>" + sw(p.color) + esc(emdName(p)) + "</h4>" +
            '<p class="sub">도시쇠퇴도 8유형</p><div class="ag-kv">' +
            "<b>유형</b><span>" + esc(p.class_8) + (p.class_3 && p.class_3 !== p.class_8 ? " (3유형: " + esc(p.class_3) + ")" : "") + "</span>" +
            "<b>전환 활용 가중치</b><span>" + (p.weight != null ? p.weight : "—") + "</span>" +
            "<b>인구 (최대 대비)</b><span>" + pc(p.pop_to_max) + "</span>" +
            "<b>사업체 (최대 대비)</b><span>" + pc(p.busi_to_max) + "</span>" +
            "<b>20년 이상 건물 비율</b><span>" + pc(p.old_bd20r) + "</span></div>" +
            '<p class="ag-hint">인구·사업체는 그 동의 최대치 대비 지금 값(1 에 가까울수록 유지). 도시쇠퇴도는 인구감소·사업체감소·노후건축물 세 지표의 조합입니다.</p>';
        });
      },
    }).addTo(map);
  }

  /* 토지특성 — 공업 용도지역 */
  function drawIndustrial(fc) {
    if (!fc) { disable("ag-l-ind", "ag-l-ind-n"); return; }
    indMeta = fc.meta || {};
    layers.ind = L.geoJSON(fc, {
      pane: "indPane",
      style: function (f) { return { color: "#a16207", weight: 0.6, fillColor: f.properties.color || "#e8b450", fillOpacity: 0.6 }; },
      onEachFeature: function (f, l) {
        var p = f.properties, nm = p.name || p.zone || p["용도지역"] || p["용도지역명"] || "공업지역";
        l.bindTooltip(esc(nm) + (p.area_ha ? " · " + num(Math.round(p.area_ha)) + " ha" : ""), { sticky: true, className: "lbl-st" });
      },
    }).addTo(map);
    $("ag-l-ind-n").textContent = "(" + fc.features.length + ")";
  }

  /* 역세권 1km 버퍼(원) — 역마다 1,000m */
  function bufferGroup(items, pane, fillOpacity) {
    var g = L.layerGroup();
    items.forEach(function (s) { L.circle([s.lat, s.lon], { pane: pane, radius: 1000, color: "#5b8fbf", weight: 0.8, fillColor: "#c6dbef", fillOpacity: fillOpacity, interactive: false }).addTo(g); });
    return g;
  }
  function drawBuffer(doc) { layers.buf = bufferGroup(doc.items, "bufPane", 0.35).addTo(map); }

  /* 전환 우선순위 A·B 등급 — 굵은 테두리 + 옅은 채움, 노후년도 색이 비치게 */
  function drawGrade(fc) {
    if (!fc) { disable("ag-l-grade", "ag-l-grade-n"); return; }
    gradeMeta = fc.meta || {};
    layers.grade = L.geoJSON(fc, {
      pane: "gradePane",
      style: function (f) { var c = GRADE_COLOR[f.properties.grade] || f.properties.color; return { color: c, weight: 3, fillColor: c, fillOpacity: 0.22 }; },
      onEachFeature: function (f, l) {
        var p = f.properties;
        l.bindTooltip("<b>" + esc(p.grade) + "등급</b> " + esc(p.name) + "<br>종합 " + p["종합점수"] + "점 · 추천 " + esc(p["추천용도"] || "—") + (p["노후년도"] ? " · " + Math.round(p["노후년도"]) + "년" : ""), { sticky: true, className: "lbl-st" });
        l.on("click", function (e) {
          if (e.originalEvent) L.DomEvent.stop(e);
          if (measuring && e.latlng) { addMeasure(e.latlng); return; }
          var crit = (gradeMeta["등급기준"] || {})[p.grade] || "";
          side.innerHTML = "<h4>" + gradeChip(p.grade) + " " + esc(p.name) + "</h4>" +
            '<p class="sub">전환 우선순위 · ' + esc(p.unit_type || "") + "</p>" +
            '<div class="ag-kv"><b>종합점수</b><span>' + p["종합점수"] + " / 100</span>" +
            "<b>추천 용도</b><span>" + esc(p["추천용도"] || "—") + "</span>" +
            (p["노후년도"] ? "<b>노후년도</b><span>" + Math.round(p["노후년도"]) + "년</span>" : "") +
            preRow(RK[p.unit_id]) +
            "<b>등급 뜻</b><span>" + esc(crit) + "</span></div>" +
            '<p class="ag-hint">⑤ 절의 표에서 점수 구성과 종상향 방식을 볼 수 있습니다.</p>';
        });
      },
    }).addTo(map);
    $("ag-l-grade-n").textContent = "(" + fc.features.length + ")";
  }

  /* 역세권 1km 안 산단 영역 */
  var zoneTip = function (p) { return esc(p.DAN_NAME) + " · 역세권 안 " + num(p["역세권면적_ha"]) + " ha (" + Math.round(p["역세권비율"] * 100) + "%)"; };
  function drawZone(fc) {
    if (!fc) return;
    layers.zone = L.geoJSON(fc, {
      pane: "zonePane", style: ZONE,
      onEachFeature: function (f, l) { l.bindTooltip(zoneTip(f.properties) + "<br>" + esc(f.properties["역세권_역"]), { sticky: true, className: "lbl-st" }); },
    }).addTo(map);
  }

  /* 역 */
  function stationGroup(items, pane, r, onClick) {
    var g = L.layerGroup();
    items.forEach(function (s) {
      var o = L.circleMarker([s.lat, s.lon], { pane: pane, radius: r, color: "#000", weight: 1.3, fillColor: "#fff", fillOpacity: 1 });
      o.bindTooltip(esc(s.name) + "역" + (s.lines ? " · " + esc(s.lines) : "") + (s.gtx ? " · GTX " + esc(s.gtx) : ""), { direction: "top", offset: [0, -6], className: "lbl-st" });
      if (onClick) o.on("click", function (e) { L.DomEvent.stop(e); onClick(s, e); });
      o.addTo(g);
      L.circleMarker([s.lat, s.lon], { pane: pane, radius: r / 3, color: "#000", weight: 0, fillColor: "#000", fillOpacity: 1, interactive: false }).addTo(g);
    });
    return g;
  }
  function drawStations(doc) {
    stations = doc.items;
    layers.st = stationGroup(stations, "stPane", 5, function (s, e) { if (measuring) { addMeasure(e.latlng); return; } stationZone(s); }).addTo(map);
  }

  /* 역세권 — 반경 안에 걸치는 산단 */
  function clearRing() {
    if (ring) { map.removeLayer(ring); ring = null; }
    if (ringDash) { map.removeLayer(ringDash); ringDash = null; }
  }
  function stationZone(s) {
    var c = [s.lat, s.lon];
    clearRing();
    ring = L.circle(c, { radius: radius, color: PICK, weight: 2, fillColor: PICK, fillOpacity: 0.08, interactive: false }).addTo(map);
    if (radius > 500) ringDash = L.circle(c, { radius: 500, color: PICK, weight: 1, dashArray: "4 4", fill: false, interactive: false }).addTo(map);
    var hits = [];
    cxIndex.forEach(function (x) { var d = polyDist(c, x.geom); if (d <= radius) hits.push({ x: x, d: Math.round(d) }); });
    hits.sort(function (a, b) { return a.d - b.d || (b.x.p.age || 0) - (a.x.p.age || 0); });
    var old = hits.filter(function (h) { return h.x.p.age != null && h.x.p.age >= 30; }).length;
    side.innerHTML =
      "<h4>◉ " + esc(s.name) + "역</h4>" +
      '<p class="sub">' + esc(s.lines || "") + (s.gtx ? " · GTX " + esc(s.gtx) : "") + (s.sgg ? " · " + esc(s.sgg) : "") + "</p>" +
      '<div class="ag-kv"><b>반경</b><span>' + (radius >= 1000 ? (radius / 1000) + " km" : radius + " m") + " (직선)</span>" +
      "<b>걸치는 산단</b><span>" + hits.length + "곳" + (old ? " · 30년 이상 " + old + "곳" : "") + "</span></div>" +
      (hits.length ? '<ul class="ag-list">' + hits.map(function (h, i) {
        var p = h.x.p, a = p.matched ? p.age : null;
        return '<li data-i="' + i + '"><span class="nm">' + esc(p.name) + (p.lname && p.lname !== p.name ? "<br><small class=\"ag-mute\">" + esc(p.lname.split(" / ")[0]) + "</small>" : "") + "</span>" +
          '<span class="age" style="background:' + (a == null ? UNMATCHED : (a >= 30 ? "#a31c1c" : a >= 15 ? "#c57171" : "#b9a6a6")) + '">' + (a == null ? "?" : a + "년") + "</span>" +
          '<span class="km">' + (h.d === 0 ? "역이 안에" : h.d + " m") + "</span></li>";
      }).join("") + "</ul>" : '<p class="ag-hint">이 반경 안에 걸치는 산단이 없습니다. 반경을 키워 보세요.</p>') +
      '<p class="ag-hint">거리는 역에서 산단 경계까지의 직선거리입니다. 목록을 누르면 그 산단으로 갑니다.</p>';
    side.querySelectorAll("li[data-i]").forEach(function (li) {
      li.addEventListener("click", function () {
        var h = hits[+li.dataset.i];
        highlight(h.x.layer);
        map.fitBounds(h.x.layer.getBounds().extend(c), { padding: [30, 30], maxZoom: 14 });
      });
    });
    map.fitBounds(ring.getBounds(), { padding: [20, 20] });
  }

  /* 거리 재기 */
  function setMeasuring(on) {
    measuring = on;
    document.body.classList.toggle("measuring", on);
    var b = $("ag-measure");
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
    mTips.push(L.tooltip({ permanent: true, direction: "right", offset: [8, 0], className: "ag-ruler", interactive: false }).setLatLng(latlng).setContent(txt).addTo(map));
    mTips.push(L.circleMarker(latlng, { radius: 3, color: "#1c1a19", fillColor: "#fff", fillOpacity: 1, weight: 1.5, interactive: false }).addTo(map));
    side.innerHTML = "<h4>📏 거리 재기</h4>" +
      '<div class="ag-kv"><b>점</b><span>' + mPts.length + "개</span><b>모두</b><span>" + fmtM(total) + "</span>" + (mPts.length > 1 ? "<b>마지막 구간</b><span>" + fmtM(seg) + "</span>" : "") + "</div>" +
      '<p class="ag-hint">직선거리(구면)입니다. 두 번 누르면 끝나고, 「지우기」 로 지웁니다.</p>';
  }

  /* 빈 곳 클릭 — 인구밀도 */
  function showDensity(latlng) {
    var v = densityAt(latlng);
    var k = v == null ? -1 : densityClass(v);
    side.innerHTML = "<h4>이 자리의 인구밀도</h4>" +
      '<div class="ag-kv"><b>밀도</b><span>' + (v == null ? "자료 밖" : v ? "약 " + num(v) + " " + popMeta.unit.split(" ")[0] : "0 (사람 없음)") + "</span>" +
      "<b>급간</b><span>" + (k >= 0 ? sw(popMeta.colors[k]) + popMeta.labels[k] : "—") + "</span>" +
      "<b>위치</b><span>" + latlng.lat.toFixed(5) + ", " + latlng.lng.toFixed(5) + "</span></div>" +
      '<p class="ag-hint">약 500m 칸의 평균값입니다(그림은 100m 격자). 역을 누르면 반경 안 산단이, 산단을 누르면 노후년도가 나옵니다.</p>';
  }

  /* 범례 */
  var legItem = function (color, label, em, extra) { return "<span" + (extra || "") + '><i style="background:' + color + '"></i>' + label + (em ? "<em>" + em + "</em>" : "") + "</span>"; };
  function decLegend(meta) {
    var cnt = meta["유형수"] || {}, w = meta["가중치"] || {}, col = meta["색"] || {};
    return Object.keys(col).sort(function (a, b) { return (w[b] || 0) - (w[a] || 0) || (cnt[b] || 0) - (cnt[a] || 0); })
      .map(function (k) { return legItem(col[k], esc(k.replace("지역", "")), (w[k] != null ? w[k] : "") + (cnt[k] ? " · " + cnt[k] + "동" : "")); }).join("");
  }
  function legend() {
    var el = $("ag-legend0");
    var gc = GRADE_COLOR;
    var indCols = indMeta ? (indMeta["색"] || indMeta.colors || { "공업 용도지역": "#e8b450" }) : null;
    el.innerHTML = '<h4>범례 <button type="button" class="ag-legend__t" id="ag-legend-t" aria-expanded="true">▾ 접기</button></h4>' +
      "<b>노후년도 (2026 − 지정 연도)</b>" +
      AGE_CLASSES.map(function (c) { return legItem(c[2], c[0] + " – " + (c[1] === 63 ? 62 : c[1])); }).join("") +
      legItem(UNMATCHED, "목록과 짝 없음") +
      '<span><i class="zone"></i>역세권 안 산단 영역</span>' +
      "<b>인구밀도 (명/㎢, 100m 격자)</b>" +
      popMeta.colors.map(function (c, i) { return legItem(c, popMeta.labels[i]); }).join("") +
      (decMeta && decMeta["색"] ? "<b>도시쇠퇴도 8유형 (행정동 · 가중치)</b>" + decLegend(decMeta) : "") +
      (indCols ? "<b>공업 용도지역</b>" + Object.keys(indCols).map(function (k) { return legItem(indCols[k], esc(k)); }).join("") : "") +
      (gradeMeta ? "<b>전환 우선순위 등급 (지도에는 A·B만)</b>" + ["A", "B", "C", "D"].map(function (k) { return legItem(gc[k] || "#999", k + " " + GRADE_TXT[k]); }).join("") : "") +
      "<b>역세권 · 역</b>" +
      '<span><i class="buf"></i>역세권 1km 원</span>' +
      '<span><i class="st"></i>철도역</span>';
    $("ag-legend-t").addEventListener("click", function () {
      var off = el.classList.toggle("folded");
      this.textContent = off ? "▸ 펴기" : "▾ 접기";
      this.setAttribute("aria-expanded", String(!off));
    });
  }

  /* 단추·체크 */
  function wire() {
    var box = $("ag-map0");
    var on = function (id, fn) { var el = $(id); if (el) el.addEventListener("change", function () { fn(el.checked); }); };
    var tog = function (layer, show) { if (!layer) return; if (show) layer.addTo(map); else map.removeLayer(layer); };
    on("ag-l-cx", function (v) { tog(layers.cx, v); box.classList.toggle("no-dan", !v || !$("ag-l-ldan").checked); });
    ["zone", "dec", "ind", "grade", "buf", "st", "pop", "emd"].forEach(function (k) { on("ag-l-" + k, function (v) { tog(layers[k], v); }); });
    on("ag-l-lsi", function (v) { box.classList.toggle("no-si", !v); });
    on("ag-l-ldan", function (v) { box.classList.toggle("no-dan", !v); });
    on("ag-l-base", function (v) {
      if (v && !base) base = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri · HERE · OpenStreetMap contributors" });
      if (v) { base.addTo(map); base.bringToBack(); } else if (base) map.removeLayer(base);
    });
    document.querySelectorAll("[data-r]").forEach(function (b) {
      b.addEventListener("click", function () {
        radius = +b.dataset.r;
        document.querySelectorAll("[data-r]").forEach(function (x) { x.classList.toggle("active", x === b); });
        if (ring) { var s = nearestStation(ring.getLatLng()); if (s) stationZone(s); }
      });
    });
    $("ag-measure").addEventListener("click", function () { setMeasuring(!measuring); });
    $("ag-clear").addEventListener("click", function () {
      setMeasuring(false); clearMeasure(); clearRing(); highlight(null);
      side.innerHTML = SIDE_HINT;
    });
    map.on("click", function (e) { if (measuring) { addMeasure(e.latlng); return; } showDensity(e.latlng); });
    map.on("dblclick", function (e) { if (measuring) { L.DomEvent.stop(e); setMeasuring(false); } });
  }
  function nearestStation(c) {
    var best = null, bd = Infinity;
    stations.forEach(function (s) { var d = dist(c, [s.lat, s.lon]); if (d < bd) { bd = d; best = s; } });
    return best;
  }

  /* ---------- 절 차례 — 지금 보는 절을 진하게 ---------- */
  function toc() {
    var nav = $("ag-toc"); if (!nav || !("IntersectionObserver" in window)) return;
    var links = {}; nav.querySelectorAll("a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var vis = {};
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { vis[e.target.id] = e.isIntersecting; });
      var cur = Object.keys(links).filter(function (id) { return vis[id]; })[0];
      if (!cur) return;
      Object.keys(links).forEach(function (id) { links[id].classList.toggle("on", id === cur); });
      var a = links[cur]; nav.scrollTo({ left: a.offsetLeft - 16, behavior: "smooth" });
    }, { rootMargin: "-150px 0px -55% 0px" });
    Object.keys(links).forEach(function (id) { var s = $(id); if (s) io.observe(s); });
  }

  /* ---------- 그림 확대 (라이트박스) — .ag-zoom 그림 · .ag-png 단추 ---------- */
  var openLB = function () {};
  function lightbox() {
    var lb = $("ag-lb"), img = $("ag-lb-img"), cap = $("ag-lb-cap");
    if (!lb) return;
    var sc = 1, tx = 0, ty = 0, drag = null;
    var apply = function () { img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + sc + ")"; };
    var fit = function () {
      var W = lb.clientWidth, H = lb.clientHeight, w = img.naturalWidth || 1, h = img.naturalHeight || 1;
      sc = Math.min((W - 40) / w, (H - 80) / h, 1); tx = (W - w * sc) / 2; ty = (H - h * sc) / 2; apply();
    };
    openLB = function (src, text) {
      cap.textContent = text || ""; lb.classList.add("on"); document.body.style.overflow = "hidden";
      img.onload = fit; img.src = src; if (img.complete) fit();
    };
    var close = function () { lb.classList.remove("on"); document.body.style.overflow = ""; };
    document.addEventListener("click", function (e) {
      var im = e.target.closest("img.ag-zoom");
      if (im) { var f = im.closest("figure"), fc = f && f.querySelector("figcaption"); openLB(im.currentSrc || im.src, fc ? fc.textContent : im.alt); return; }
      var b = e.target.closest(".ag-png[data-png]");
      if (b) openLB(b.dataset.png + "?v=" + VER, b.dataset.cap || "");
    });
    $("ag-lb-x").addEventListener("click", close);
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && lb.classList.contains("on")) close(); });
    lb.addEventListener("wheel", function (e) {
      e.preventDefault();
      var k = e.deltaY < 0 ? 1.15 : 1 / 1.15, ns = Math.max(0.2, Math.min(12, sc * k));
      tx = e.clientX - (e.clientX - tx) * (ns / sc); ty = e.clientY - (e.clientY - ty) * (ns / sc); sc = ns; apply();   // 마우스 자리를 기준으로
    }, { passive: false });
    img.addEventListener("mousedown", function (e) { e.preventDefault(); drag = { x: e.clientX - tx, y: e.clientY - ty }; img.classList.add("drag"); });
    window.addEventListener("mousemove", function (e) { if (!drag) return; tx = e.clientX - drag.x; ty = e.clientY - drag.y; apply(); });
    window.addEventListener("mouseup", function () { drag = null; img.classList.remove("drag"); });
    img.addEventListener("dblclick", fit);
    img.addEventListener("touchstart", function (e) { if (e.touches.length === 1) drag = { x: e.touches[0].clientX - tx, y: e.touches[0].clientY - ty }; }, { passive: true });
    img.addEventListener("touchmove", function (e) { if (drag && e.touches.length === 1) { tx = e.touches[0].clientX - drag.x; ty = e.touches[0].clientY - drag.y; apply(); } }, { passive: true });
    img.addEventListener("touchend", function () { drag = null; });
  }

  /* ---------- 핵심 수치 칸 ---------- */
  function hero(key, html) { var el = document.querySelector('[data-hero="' + key + '"]'); if (el) el.innerHTML = html; }

  /* ---------- ③ 역세권 1km 안 산단 표 ---------- */
  function stationTable() {
    getJSON(D + "analysis/station_1km_summary.json").then(function (doc) {
      var m = doc.meta || {};
      var rows = (doc.items || []).filter(function (r) { return r["역세권면적_ha"] > 0; });
      $("ag-tbl-src").textContent = "역세권 1km 안 산단 " + rows.length + "곳 / " + (m["산단수"] || "") + " · 작성 " + (m["작성"] || "");
      hero("sta", rows.length + "<small>곳</small>");
      $("ag-stat").innerHTML =
        "<div><b>" + rows.length + "곳</b><span>역세권(1km)에 걸치는 산단 / " + (m["산단수"] || "—") + "</span></div>" +
        "<div><b>" + num(Math.round(m["역세권포함면적_ha"] || 0)) + " ha</b><span>역세권 안 산단 면적 합</span></div>" +
        "<div><b>" + ((m["역세권비율_전체"] || 0) * 100).toFixed(1) + "%</b><span>전체 산단 면적 " + num(Math.round(m["전체산단면적_ha"] || 0)) + " ha 가운데</span></div>" +
        "<div><b>" + (m["GTX역세권산단수"] == null ? "—" : m["GTX역세권산단수"] + "곳") + "</b><span>GTX 역세권(1km) 산단</span></div>";
      sortTable("ag-tbl", rows, [
        { k: "DAN_NAME", label: "산업단지", cell: function (r) { return "<b>" + esc(r.DAN_NAME) + "</b>" + (r["단지명"] && r["단지명"] !== r.DAN_NAME ? "<br><small>" + esc(r["단지명"]) + "</small>" : ""); } },
        { k: "단지유형", label: "유형", cell: function (r) { return esc(r["단지유형"] || ""); } },
        { k: "노후년도", label: "노후년도", num: true, cell: function (r) { var a = r["노후년도"]; return sw(ageColor(a), "border-color:#232323") + (a == null ? "—" : a); } },
        { k: "산단면적_ha", label: "산단 ha", num: true, cell: function (r) { return num(Math.round(r["산단면적_ha"] || 0)); } },
        { k: "역세권면적_ha", label: "역세권 안 ha", num: true, cell: function (r) { return num(Math.round(r["역세권면적_ha"] || 0)); } },
        { k: "역세권비율", label: "비율", num: true, cell: function (r) { return pc(r["역세권비율"] || 0); } },
        { k: "역세권_역", label: "해당 역", cell: function (r) { return esc(r["역세권_역"] || "") + (r["GTX역세권"] ? ' <span class="ag-tag">GTX</span>' : ""); } },
        { k: "최근접역거리_m", label: "가장 가까운 역", cell: function (r) { return esc(r["최근접역"] || "") + (r["최근접역거리_m"] != null ? mute(r["최근접역거리_m"] === 0 ? "안에" : num(Math.round(r["최근접역거리_m"])) + " m") : ""); } },
      ], "역세권면적_ha", -1, { unit: function (r) { return r.DAN_ID ? "D_" + r.DAN_ID : null; } });
      $("ag-tbl-note").textContent = "비율 = 역세권 안 면적 ÷ 산단 면적. 거리는 산단 경계에서 역까지의 직선거리이고 「안에」는 역이 경계 안에 있다는 뜻입니다.";
    }).catch(function (e) {
      $("ag-tbl-src").textContent = "표 자료를 불러오지 못했습니다 — " + e.message;
    });
  }

  /* ---------- 움직이는 작은 지도 — 역세권 · 도시쇠퇴도 · 공업 용도지역 · 등급 · 준공업 판정 ----------
     공통: 시군 경계·이름, 산단 경계는 붉은 테두리 + 반투명 붉은 채움, 「노후년도 색 채움」·「산단 이름」·「철도역」은 체크박스,
           범례는 지도 밖 카드, 전체화면 단추, 정적 PNG 는 라이트박스로 보조 */
  var minis = [];
  function miniShell(el) {
    var key = el.dataset.mini;
    el.innerHTML =
      '<div class="fb-controls" id="ag-ctl-' + key + '"><span class="fb-fig__src">자료를 불러오는 중…</span></div>' +
      '<div class="ag-mini__grid">' +
        '<div class="fb-mapbox" id="ag-box-' + key + '">' +
          '<div class="fb-map" id="ag-map-' + key + '"></div>' +
          '<button type="button" class="ag-fs" data-fs="ag-box-' + key + '" title="전체화면">⛶ 전체화면</button>' +
          '<div class="fb-busy" id="ag-busy-' + key + '">지도를 그리는 중입니다…</div>' +
        "</div>" +
        '<div class="fb-card ag-legend" id="ag-legend-' + key + '"><h4>범례</h4></div>' +
      "</div>" +
      '<p class="ag-mini__foot">' + esc(el.dataset.note || "") +
        (el.dataset.png ? ' <button type="button" class="chip ag-png" data-png="' + esc(el.dataset.png) + '" data-cap="' + esc(el.dataset.cap || "") + '">정적 그림(PNG) 크게 보기</button>' : "") + "</p>";
  }
  function miniMaps(d) {
    document.querySelectorAll("[data-mini]").forEach(miniShell);
    function build(key, spec) {
      var mapEl = $("ag-map-" + key); if (!mapEl) return;
      var mm = L.map(mapEl, { preferCanvas: true, scrollWheelZoom: true, zoomSnap: 0.25 }).setView(GG_CENTER, GG_ZOOM);
      L.control.scale({ imperial: false }).addTo(mm);
      [["pBase", 300], ["pSig", 350], ["pCx", 400], ["pTop", 420], ["pSt", 430], ["pLbl", 600]].forEach(function (p) { mm.createPane(p[0]); mm.getPane(p[0]).style.zIndex = p[1]; });
      L.geoJSON(d.sig, { pane: "pSig", style: { color: "#232323", weight: 0.8, fill: false }, interactive: false }).addTo(mm);
      sigLabels(d.sig, "pLbl", mm);
      fitGG(mm, L.geoJSON(d.sig).getBounds(), false);
      var sync = function () { mapEl.classList.toggle("z-lo", mm.getZoom() < DAN_ZOOM); };
      mm.on("zoomend", sync); sync();
      /* 산단 경계 — 붉은 테두리 + 반투명 붉은 채움, 「노후년도 색 채움」 을 켜면 그 색표로 */
      var fillOn = false, cxL = null, lblGrp = L.layerGroup(), cxA = spec.cxFill != null ? spec.cxFill : 0.5;
      var cxStyle = function (f) { var p = f.properties; return fillOn ? { color: "#232323", weight: 0.9, fillColor: ageColor(p.matched ? p.age : null), fillOpacity: 0.95 } : { color: "#a35650", weight: 1.5, fillColor: "#a35650", fillOpacity: cxA }; };
      if (d.cx) {
        cxL = L.geoJSON(d.cx, { pane: "pCx", style: cxStyle, onEachFeature: function (f, l) {
          var p = f.properties;
          var tip = esc(p.name) + (p.matched && p.age != null ? " · 노후 " + p.age + "년" : " · 목록 짝 없음") + (p.near_st ? " · " + esc(p.near_st) + " " + p.near_m + "m" : "");
          l.bindTooltip(function () { return tip + (spec.cxTip ? spec.cxTip(p) : ""); }, { sticky: true, className: "lbl-st" });   // 열 때 만들어 ⑤ 자료가 늦게 와도 됨
          if (p.lat && p.lon) L.tooltip({ permanent: true, direction: "center", className: "lbl lbl-dan", pane: "pLbl", interactive: false }).setLatLng([p.lat, p.lon]).setContent(p.name).addTo(lblGrp);
        } });
      }
      var stGrp = d.st ? stationGroup(d.st.items, "pSt", 4.5) : null;
      var items = spec.layers.concat([
        { key: "cx", label: "산업단지 경계", sw: "background:rgba(163,86,80," + cxA + ");border-color:#a35650", on: true, layer: cxL },
        { key: "fill", label: "노후년도 색 채움", sw: "background:#c57171;border-color:#232323", on: false, toggle: function (v) { fillOn = v; if (cxL) cxL.setStyle(cxStyle); } },
        { key: "lbl", label: "산단 이름", sw: "background:#3232fa", on: true, layer: lblGrp },
        { key: "st", label: "철도역", sw: "border-radius:50%;background:#fff;border-color:#000", on: spec.stOn !== false, layer: stGrp },
      ]);
      var ctl = $("ag-ctl-" + key);
      ctl.innerHTML = "<fieldset><legend>켜고 끄기</legend>" + items.map(function (it) {
        return '<label class="fb-check"><input type="checkbox" data-mk="' + it.key + '"' + (it.on ? " checked" : "") + (!it.layer && !it.toggle ? " disabled" : "") + '><span class="sw" style="' + it.sw + '"></span>' + esc(it.label) + "</label>";
      }).join("") + (spec.hint ? '<span class="fb-fig__src">' + esc(spec.hint) + "</span>" : "") + "</fieldset>";
      items.forEach(function (it) {
        if (it.toggle) it.toggle(it.on); else if (it.layer && it.on) it.layer.addTo(mm);
        var cb = ctl.querySelector('[data-mk="' + it.key + '"]');
        cb.addEventListener("change", function () { if (it.toggle) it.toggle(cb.checked); else if (it.layer) { if (cb.checked) it.layer.addTo(mm); else mm.removeLayer(it.layer); } });
      });
      $("ag-legend-" + key).innerHTML = "<h4>" + esc(spec.title) + "</h4>" + spec.legend +
        "<b>공통</b>" + legItem("rgba(163,86,80," + cxA + ");border-color:#a35650", "산업단지 경계 (붉은 " + Math.round(cxA * 100) + "%)") +
        legItem("linear-gradient(90deg,#fbecec,#970000)", "노후년도 색(켜면) 0→62년") + '<span><i class="st"></i>철도역</span>';
      $("ag-busy-" + key).hidden = true;
      (window.__agMini = window.__agMini || {})[key] = mm;              // 시험·디버그용 손잡이
      minis.push(mm);
    }
    /* 화면에 들어오면 그리기 — 숨은 지도(④ 공업지역)는 탭을 누를 때 */
    var later = function (key, specFn) {
      var el = document.querySelector('[data-mini="' + key + '"]'); if (!el) return;
      var done = false;
      el._draw = function () { if (done || el.hidden) return; done = true; build(key, specFn()); };
      whenVisible(el, el._draw);
    };
    var pop = function (o) { return function (f, l) { l.bindTooltip(o.tip(f.properties), { sticky: true, className: "lbl-st" }); if (o.pop) l.bindPopup(function () { return o.pop(f.properties); }); }; };

    if (d.st) later("sta", function () {
      return {
        title: "역세권(철도역 1km) 포함 영역",
        layers: [
          { key: "buf", label: "역세권 1km 원", sw: "border-radius:50%;background:#c6dbef;border-color:#5b8fbf", on: true, layer: bufferGroup(d.st.items, "pBase", 0.45) },
          { key: "zone", label: "역세권 안 산단 영역", sw: "background:#821e32;border-color:#634b4f", on: true, layer: d.zone ? L.geoJSON(d.zone, { pane: "pTop", style: { color: "#634b4f", weight: 1, fillColor: "#821e32", fillOpacity: 0.75 }, onEachFeature: pop({
            tip: zoneTip,
            pop: function (p) { return "<b>" + esc(p.DAN_NAME) + "</b> " + esc(p["단지유형"] || "") + (p["노후년도"] != null ? " · 노후 " + p["노후년도"] + "년" : "") + "<br>산단 " + num(p["산단면적_ha"]) + " ha 중 역세권 안 " + num(p["역세권면적_ha"]) + " ha (" + Math.round(p["역세권비율"] * 100) + "%)<br>" + esc(p["역세권_역"] || "") + (p["GTX역세권"] ? " · GTX" : ""); },
          }) }) : null },
        ],
        legend: '<span><i class="buf"></i>역세권 1km 원 (역 ' + d.st.n + ")</span>" + legItem("#821e32;border-color:#634b4f", "역세권 안 산단 영역" + (d.zone ? " (" + d.zone.features.length + ")" : "")),
        hint: "역세권 안 영역 = 역 1km 원 ∩ 산단 경계",
      };
    });
    if (d.dec) later("dec", function () {
      return {
        title: "도시쇠퇴도 8유형", stOn: false,
        layers: [{ key: "dec", label: "도시쇠퇴도 8유형 (행정동)", sw: "background:#6a2fe0;border-color:#1f1fff", on: true, layer: L.geoJSON(d.dec, { pane: "pBase",
          style: function (f) { return { color: "rgba(0,0,0,.18)", weight: 0.4, fillColor: f.properties.color || "#999", fillOpacity: 0.78 }; },
          onEachFeature: pop({
            tip: function (p) { return esc(emdName(p)) + " · " + esc(p.class_8); },
            pop: function (p) { return "<b>" + esc(emdName(p)) + "</b><br>" + sw(p.color) + esc(p.class_8) + (p.weight != null ? " · 가중치 " + p.weight : "") + "<br>인구 " + pc(p.pop_to_max) + " · 사업체 " + pc(p.busi_to_max) + " (최대 대비) · 20년↑건물 " + pc(p.old_bd20r); },
          }) }) }],
        legend: "<b>유형 · 전환 활용 가중치 · 행정동 수</b>" + decLegend(d.dec.meta || {}),
        hint: "행정동 " + d.dec.features.length + "곳",
      };
    });
    if (d.ind) later("ind", function () {
      var m2 = d.ind.meta || {}, col2 = m2["색"] || m2.colors || {}, area = m2["면적_ha"] || {};
      return {
        title: "토지특성 — 공업 용도지역", stOn: false,
        layers: [{ key: "ind", label: "공업 용도지역 (일반·준·전용)", sw: "background:#c98bd9;border-color:#4a1f66", on: true, layer: L.geoJSON(d.ind, { pane: "pBase",
          style: function (f) { return { color: "#5b2c85", weight: 0.7, fillColor: f.properties.color || "#e8b450", fillOpacity: 0.85 }; },
          onEachFeature: pop({
            tip: function (p) { return esc(p.name || p.zone || "공업지역") + (p.area_ha ? " · " + num(Math.round(p.area_ha)) + " ha" : ""); },
            pop: function (p) { return "<b>" + esc(p.name || p.zone || "공업지역") + "</b><br>" + (p.area_ha ? "면적 " + num(Math.round(p.area_ha * 10) / 10) + " ha" : ""); },
          }) }) }],
        legend: "<b>용도지역 · 면적</b>" + Object.keys(col2).map(function (k) { return legItem(col2[k], esc(k), area[k] != null ? num(Math.round(area[k])) + " ha" : ""); }).join(""),
        hint: (m2["필지수"] ? "필지 " + num(m2["필지수"]) + "개 · " : "") + d.ind.features.length + "구역",
      };
    });
    if (d.grade) later("grade", function () {
      var gm = d.grade.meta || {}, gc = GRADE_COLOR, crit = gm["등급기준"] || {};
      return {
        title: "전환 우선순위 등급", cxFill: 0.25,       // 산단 채움을 옅게 — A 색(#821e32)과 안 겹치게
        cxTip: function (p) { var rk = RK["D_" + p.id]; return rk ? "<br>" + gradeChip(rk["등급"]) + " " + rk["종합점수"] + "점 · " + reasonChip(rk) + unsoldRow(rk) : ""; },
        layers: [{ key: "grade", label: "A·B 등급 (A 는 굵은 테두리)", sw: "background:#c88278;border-color:#821e32", on: true, layer: L.geoJSON(d.grade, { pane: "pTop",
          style: function (f) { var p = f.properties, c = GRADE_COLOR[p.grade] || p.color; return { color: p.grade === "A" ? "#634b4f" : c, weight: p.grade === "A" ? 3 : 2.2, fillColor: c, fillOpacity: 0.7 }; },
          onEachFeature: pop({
            tip: function (p) { return "<b>" + esc(p.grade) + "</b> " + esc(p.name) + " · " + p["종합점수"] + "점"; },
            pop: function (p) {
              var rk = RK[p.unit_id] || {};
              return gradeChip(p.grade) + " <b>" + esc(p.name) + "</b><br>종합 " + p["종합점수"] + "점 · 추천 " + esc(p["추천용도"] || "—") + (p["노후년도"] ? " · 노후 " + Math.round(p["노후년도"]) + "년" : "") +
                "<br>0단계 전제 " + reasonChip(rk) + (rk.busi_decline != null ? " · 사업체 " + declRate(rk) : "") + (rk.decl_class ? " · " + esc(rk.decl_class) : "") + "<br><small>" + esc(crit[p.grade] || "") + "</small>";
            },
          }) }) }],
        legend: "<b>등급 (지도에는 A·B 폴리곤만, C·D 는 산단 경계로)</b>" + ["A", "B", "C", "D"].map(function (k) { return legItem((gc[k] || "#999") + (k === "A" ? ";border:2px solid #634b4f" : ""), k + " " + GRADE_TXT[k]); }).join("") +
          legItem("#e5e5e5;border-color:#9a9a9a", "「산업 유지」 = 0단계 전제(사업체 감소) 미충족 → C (산단 말풍선에 표시)", "", ' class="wide"'),
        hint: "A·B " + d.grade.features.length + "곳",
      };
    });
    if (d.resid) later("resid", function () {
      var rm = d.resid.meta || {}, rc = rm["색"] || {}, rn = rm["판정수"] || {}, rk = rm["판정기준"] || {};
      return {
        title: "준공업지역 실제 기능 판정", stOn: false,
        layers: [{ key: "resid", label: "판정 (행정동별 준공업 필지 묶음)", sw: "background:#c0392b;border-color:#7f1d1d", on: true, layer: L.geoJSON(d.resid, { pane: "pTop",
          style: function (f) { return { color: "rgba(0,0,0,.35)", weight: 0.6, fillColor: f.properties.color || "#999", fillOpacity: 0.85 }; },
          onEachFeature: pop({
            tip: function (p) { return esc(p.name) + " · " + esc(p["판정"]); },
            pop: function (p) {
              return "<b>" + esc(p.name) + "</b><br>" + sw(p.color) + esc(p["판정"]) +
                "<br>준공업 " + num(Math.round(p["준공업면적_ha"] * 10) / 10) + " ha · 필지 " + num(p["필지수"]) + " · 건물 " + num(Math.round(p["건물수"] || 0)) + "(용도 확인 " + num(Math.round(p["용도확인건물수"] || 0)) + ")" +
                "<br>연면적 — 주거 " + pc(p["주거_연면적비율"]) + " · 산업 " + pc(p["산업_연면적비율"]) + " · 상업근생 " + pc(p["상업근생_연면적비율"]) +
                "<br>30년 이상 건물 " + pc(p["건물30년이상비율"]) + (p["쇠퇴유형"] ? " · " + esc(p["쇠퇴유형"]) : "");
            },
          }) }) }],
        legend: "<b>판정 · 행정동 수</b>" + Object.keys(rc).map(function (k) { return legItem(rc[k], esc(k), rn[k] != null ? rn[k] : "", ' title="' + esc(rk[k] || "") + '"'); }).join(""),
        hint: "행정동 " + d.resid.features.length + "곳 · 준공업 " + num(rm["준공업면적_ha"] || 0) + " ha",
      };
    });

    /* ④ 도시쇠퇴도 / 공업 용도지역 — 한 자리에서 탭으로 */
    document.querySelectorAll("#ag-dec-tabs [data-pane]").forEach(function (b) {
      b.addEventListener("click", function () {
        document.querySelectorAll("#ag-dec-tabs [data-pane]").forEach(function (x) { x.classList.toggle("active", x === b); });
        ["dec", "ind"].forEach(function (k) {
          var el = document.querySelector('[data-mini="' + k + '"]'); if (!el) return;
          el.hidden = k !== b.dataset.pane;
          if (!el.hidden) { if (el._draw) el._draw(); var mm = (window.__agMini || {})[k]; if (mm) mm.invalidateSize(); }
        });
      });
    });
    /* 전체화면 — 나갈 때 크기 다시 셈 */
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".ag-fs[data-fs]"); if (!b) return;
      var box = $(b.dataset.fs); if (!box) return;
      if (document.fullscreenElement === box) document.exitFullscreen();
      else if (box.requestFullscreen) box.requestFullscreen();
    });
    document.addEventListener("fullscreenchange", function () {
      setTimeout(function () { minis.forEach(function (mm) { mm.invalidateSize(); }); }, 150);
      document.querySelectorAll(".ag-fs[data-fs]").forEach(function (b) { b.textContent = document.fullscreenElement && document.fullscreenElement.id === b.dataset.fs ? "✕ 전체화면 끝" : "⛶ 전체화면"; });
    });
  }

  /* ---------- ⑥ 준공업지역 실제 기능 판정 — 판정별 수 · 표 ---------- */
  function residential(geo) {
    var src = $("ag-rs-src");
    if (!geo) { src.textContent = "자료가 아직 없습니다"; return; }
    var m = geo.meta || {}, rc = m["색"] || {}, rn = m["판정수"] || {}, rk = m["판정기준"] || {};
    src.textContent = "행정동 " + geo.features.length + "곳 · 준공업지역 " + num(m["준공업면적_ha"] || 0) + " ha · 기준일 " + (m["기준일"] || "");
    var ORDER = ["주거기능전환지역", "주거·상업 복합전환지역", "주공혼재지역(주거우세)", "주공혼재지역(산업우세)", "산업기능유지지역", "소규모(판정 제외)"];
    $("ag-rs-stat").innerHTML = ORDER.filter(function (k) { return rn[k] != null; }).map(function (k) {
      return "<div><b>" + sw(rc[k] || "#999") + rn[k] + "곳</b><span>" + esc(k) + (rk[k] ? " — " + esc(rk[k]) : "") + "</span></div>";
    }).join("");
    getJSON(D + "analysis/residential_shift_table.json").then(function (t) {
      var rows = (t.items || []).map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); o.name = o["행정동"]; return o; });
      var cols = [
        { k: "name", label: "행정동", cell: function (r) { return "<b>" + esc(r.name) + "</b>"; } },
        { k: "판정", label: "판정", cell: function (r) { return sw(rc[r["판정"]] || "#999") + esc((r["판정"] || "").replace("지역", "")); } },
        { k: "준공업면적_ha", label: "준공업 ha", num: true, cell: function (r) { return num(Math.round((r["준공업면적_ha"] || 0) * 10) / 10); } },
        { k: "필지수", label: "필지", num: true, cell: function (r) { return num(r["필지수"] || 0); } },
        { k: "용도확인건물수", label: "용도 확인 건물", num: true, cell: function (r) { return num(Math.round(r["용도확인건물수"] || 0)) + "/" + num(Math.round(r["건물수"] || 0)); } },
        { k: "주거_연면적비율", label: "주거 연면적", num: true, cell: function (r) { return pc(r["주거_연면적비율"]); } },
        { k: "산업_연면적비율", label: "산업 연면적", num: true, cell: function (r) { return pc(r["산업_연면적비율"]); } },
        { k: "상업근생_연면적비율", label: "상업근생", num: true, cell: function (r) { return pc(r["상업근생_연면적비율"]); } },
        { k: "건물30년이상비율", label: "30년↑건물", num: true, cell: function (r) { return pc(r["건물30년이상비율"]); } },
        { k: "쇠퇴유형", label: "쇠퇴유형", cell: function (r) { return esc((r["쇠퇴유형"] || "—").replace("지역", "")); } },
      ];
      var judged = rows.filter(function (r) { return r["판정"] !== "소규모(판정 제외)"; }).length;
      var cur = "판정됨";
      var show = function () {
        var L2 = cur === "모두" ? rows : rows.filter(function (r) { return cur === "판정됨" ? r["판정"] !== "소규모(판정 제외)" : r["판정"] === cur; });
        sortTable("ag-rs-tbl", L2, cols, "주거_연면적비율", -1, { rank: true });
        $("ag-rs-note").textContent = L2.length + "곳 · 주거 연면적 비율이 큰 차례(머리글을 누르면 바뀜). 비율은 용도를 확인한 건물의 연면적 기준.";
      };
      var tabs = [["판정됨", "판정된 " + judged + "곳"], ["주거기능전환지역", "주거기능전환"], ["주거·상업 복합전환지역", "주거·상업 복합"], ["산업기능유지지역", "산업기능유지"], ["모두", "소규모 포함 전체"]];
      $("ag-rs-tabs").innerHTML = tabs.map(function (x) { return '<button type="button" class="chip' + (x[0] === cur ? " active" : "") + '" data-rs="' + esc(x[0]) + '">' + esc(x[1]) + "</button>"; }).join("");
      $("ag-rs-tabs").addEventListener("click", function (e) {
        var b = e.target.closest("[data-rs]"); if (!b) return;
        cur = b.dataset.rs;
        this.querySelectorAll("[data-rs]").forEach(function (x) { x.classList.toggle("active", x === b); });
        show();
      });
      show();
    }).catch(function (e) { $("ag-rs-note").textContent = "표 자료를 불러오지 못했습니다 — " + e.message; });
  }

  /* ---------- ⑤ 전환 우선순위 — 요약 · 로직 · 표 셋 ---------- */
  var LOGIC_COLOR = ["var(--ag-s1)", "var(--ag-s2)", "var(--ag-s3)", "var(--ag-s4)"];   // aging-charts.js 의 점수 막대와 같은 차례
  var NAMES = { "노후년도": "지정 경과", "old30": "30년↑ 건물", "year_mean": "평균 승인연도", "low_rise": "저층", "dist_sta": "최근접역 거리", "sta1km": "역 1km 면적비", "dist_gtx": "GTX", "decl": "쇠퇴 유형 가중", "semi_ind": "준공업", "ind_zone": "공업지역", "nonind": "비공업 이용", "nonfactory": "비공장 연면적", "vacant": "나지", "gap_res": "주거 지가격차", "far_low": "저용적률", "gap_com": "상업 지가격차", "pop": "인구밀도", "rescom_adj": "주거·상업 인접", "parcel": "필지", "gam": "공공기관 이전",
    "busi_decline": "사업체 감소율", "busi_fac_share": "사업체 쇠퇴 면적비", "busi_dec3y_share": "3년 연속 감소 면적비", "unsold": "산단 미분양율", "sgg_unsold": "시군 산단 미분양율" };
  var REASON_COL = { k: "판정사유", label: "0단계 판정", cell: reasonChip };
  var unitOf = function (r) { return r.unit_id; };
  var BASE_COLS = [
    { k: "시군", label: "시군", cell: function (r) { return esc(r["시군"] || ""); } },
    { k: "area_ha", label: "ha", num: true, cell: function (r) { return num(Math.round(r.area_ha || 0)); } },
    { k: "dist_station_m", label: "최근접역", num: true, cell: stTxt },
    { k: "decl_class", sort: "busi_decline", desc: true, label: "쇠퇴유형(사업체↓)", cell: declTxt },
    { k: "unsold_ratio", desc: true, label: "미분양 산단/시군", num: true, cell: unsoldTxt },   // v6
    { k: "semi_ind_ratio", label: "준공업", num: true, cell: function (r) { return pc(r.semi_ind_ratio); } },
    { k: "old30_ratio_gfa", label: "30년↑건물", num: true, cell: function (r) { return pc(r.old30_ratio_gfa); } },
    { k: "res_gfa_ratio", label: "내부 주거/상업/업무", num: true, cell: function (r) { return pct3(r.res_gfa_ratio, r.com_gfa_ratio, r.off_gfa_ratio); } },
    { k: "ring_res_ratio", label: "주변300m 주거/상업/업무", num: true, cell: function (r) { return pct3(r.ring_res_ratio, r.ring_com_ratio, r.ring_off_ratio); } },
  ];
  var nameCol = function (label) { return { k: "name", label: label, cell: function (r) { return "<b>" + esc(r.name) + "</b>"; } }; };
  var AGE_COL = { k: "노후년도", label: "노후", num: true, cell: function (r) { return r["노후년도"] == null ? "—" : Math.round(r["노후년도"]); } };
  var scoreCol = function (k) { return { k: k, label: "점수", num: true, cell: function (r) { return "<b>" + r[k] + "</b>"; } }; };
  var GRADE_COL = { k: "등급", label: "등급", cell: function (r) { return gradeChip(r["등급"]); } };
  var METHOD_COL = { k: "종상향_방식", label: "종상향 방식", small: true, cell: function (r) { return esc(r["종상향_방식"] || "–"); } };
  var USE_COL = { k: "추천용도", label: "추천", cell: useChip };
  var USE_NOTE = "쇠퇴유형 괄호 = 행정동 사업체 최대치 대비 감소율(↓). 미분양 = 산단 자체 / 같은 시군 산단 전체 미분양율(공고면적 가중, 분양현황 2026.7). 내부 = 단위 안 건축물(용도 확인분) 연면적 비율, 주변300m = 경계 밖 300m 이내 건물의 비율 (주거/상업/업무 차례).";

  function ranking() {
    Promise.all([getJSON(D + "analysis/ranking_all.json"), getJSON(D + "analysis/ranking_top10_by_use.json")]).then(function (r) {
      var all = r[0], top = r[1], m = all.meta || {}, items = all.items || [];
      var gd = m["등급분포"] || {};
      var danji = items.filter(function (x) { return x.unit_type === "산업단지"; });
      var gdD = { A: 0, B: 0, C: 0, D: 0 }; danji.forEach(function (x) { if (gdD[x["등급"]] != null) gdD[x["등급"]]++; });
      var recA = items.filter(function (x) { return x["등급"] === "A"; }).reduce(function (a, x) { return a + (x["회수가능_공업지역_ha"] || 0); }, 0);
      items.forEach(function (x) { RK[x.unit_id] = x; });
      hero("ab", (gd.A || 0) + "<small>A</small> · " + (gd.B || 0) + "<small>B</small>");
      hero("recov", num(Math.round(m["회수가능_공업지역_ha"] || 0)) + "<small>ha</small>");
      /* 0단계 전제 — 충족 / 미충족(게이트 밖 → 「산업 유지」 C) / 게이트 안에서 미충족 */
      var preOk = items.filter(function (x) { return x["전제_산업체감소"] === true; }).length,
          preNo = items.filter(function (x) { return /미충족/.test(x["판정사유"] || ""); }).length,
          preGate = items.filter(function (x) { return x["전제_산업체감소"] === false && !/미충족/.test(x["판정사유"] || ""); }).length;
      $("ag-rk-src").textContent = "단위 " + (m["단위수"] || items.length) + " · 산단 " + (m["산단수"] || "") + " · 기준일 " + (m["기준일"] || "");
      $("ag-rk-stat").innerHTML =
        "<div><b>" + (m["단위수"] || items.length) + "</b><span>분석 단위 — 산단 " + (m["산단수"] || "") + " + 산단 밖 클러스터 " + ((m["단위수"] || items.length) - (m["산단수"] || 0)) + "</span></div>" +
        "<div><b>" + (m["30년이상산단"] || "—") + "곳</b><span>30년 이상·조성완료 산단 (핵심 대상)</span></div>" +
        "<div><b>" + ["A", "B", "C", "D"].map(function (k) { return gradeChip(k) + " " + (gd[k] || 0); }).join(" ") + "</b><span>등급 (전체) · 산단만 A " + gdD.A + " · B " + gdD.B + " · C " + gdD.C + " · D " + gdD.D + "</span></div>" +
        "<div><b>" + num(Math.round(m["회수가능_공업지역_ha"] || 0)) + " ha</b><span>회수 가능 공업지역 (A등급 " + num(Math.round(recA)) + " ha)</span></div>" +
        "<div><b>" + preOk + " <small>/</small> " + preNo + "</b><span>0단계 전제(사업체 감소) 충족 / 미충족 → <span class=\"ag-keep\">산업 유지</span> C" + (preGate ? " · 게이트 D 안 미충족 " + preGate + " 별도" : "") + "</span></div>";
      var lw = m["로직가중치"] || {};
      $("ag-rk-logic").innerHTML =
        '<div class="pre"><b>0단계 전제 — 산업체 감소</b>행정동 사업체 최대치 대비 <strong>5%↓</strong> 또는 도시재생법 사업체 쇠퇴 행정동이 <strong>면적 50%↑</strong><br><small>미충족이면 점수와 관계없이 「산업 유지」(C) · 게이트 D 는 별도</small></div>' +
        Object.keys(lw).map(function (k, i) {
          return '<div style="--c:' + LOGIC_COLOR[i % 4] + '"><b>' + esc(k) + "</b>" + Object.keys(lw[k]).map(function (x) { return esc(NAMES[x] || x) + " " + lw[k][x]; }).join(" · ") + "</div>";
        }).join("");

      /* 용도별 상위 10 — 탭은 차트(aging-charts.js)와 같이 움직임 */
      var useCols = [nameCol("산업단지"), AGE_COL].concat(BASE_COLS, [scoreCol("점수"), GRADE_COL, REASON_COL, METHOD_COL]);
      var showUse = function (u) { sortTable("ag-use-tbl", top[u] || [], useCols, "점수", -1, { rank: true, unit: unitOf }); };
      $("ag-use-tabs").addEventListener("click", function (e) {
        var b = e.target.closest("[data-use]"); if (!b) return;
        this.querySelectorAll("[data-use]").forEach(function (x) { x.classList.toggle("active", x === b); });
        showUse(b.dataset.use);
        document.dispatchEvent(new CustomEvent("ag:use", { detail: b.dataset.use }));
      });
      showUse("상업용");

      /* 종합 상위 15 — 30년 이상 산단 */
      var coreAll = danji.filter(function (x) { return x["핵심필터_30년노후"]; });
      var core = coreAll.slice().sort(function (a, b) { return (b["종합점수"] || 0) - (a["종합점수"] || 0); }).slice(0, 15);
      sortTable("ag-top-tbl", core, [nameCol("산업단지"), AGE_COL].concat(BASE_COLS, [scoreCol("종합점수"), GRADE_COL, REASON_COL, USE_COL, METHOD_COL]), "종합점수", -1, { rank: true, unit: unitOf });
      $("ag-top-note").textContent = "30년 이상·조성완료 산단 " + coreAll.length + "곳 가운데 종합점수 상위 15. D는 게이트(가동 중 등)에 걸려 등급에서 빠진 곳, 「산업 유지」는 0단계 전제(사업체 감소) 미충족으로 C 에 둔 곳. " + USE_NOTE;

      /* 클러스터 상위 15 */
      var cl = items.filter(function (x) { return x.unit_type !== "산업단지"; }).sort(function (a, b) { return (b["종합점수"] || 0) - (a["종합점수"] || 0); }).slice(0, 15);
      sortTable("ag-cl-tbl", cl, [nameCol("클러스터")].concat(BASE_COLS, [scoreCol("종합점수"), GRADE_COL, REASON_COL, USE_COL]), "종합점수", -1, { rank: true, unit: unitOf });
    }).catch(function (e) {
      $("ag-rk-src").textContent = "우선순위 자료를 불러오지 못했습니다 — " + e.message;
    });
  }

  /* ---------- 차트(aging-charts.js)에 건네는 손잡이 ---------- */
  window.AG = {
    D: D, getJSON: getJSON, esc: esc, num: num, ageColor: ageColor, AGE_CLASSES: AGE_CLASSES,
    GRADE_COLOR: GRADE_COLOR, GRADE_TXT: GRADE_TXT, NAMES: NAMES, whenVisible: whenVisible, focusUnit: focusUnit,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
