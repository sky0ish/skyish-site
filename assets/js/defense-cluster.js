/* =============================================================
   [경기도 방위산업 기업체와 연구장비] — defense-cluster.html

   자료: assets/data/defense/points.json
     companies  경기도 소재 방산기업(본사 지오코딩)
     equip      연구장비 보유기관(주소 단위 집계)
     defense    그중 방산 관련 장비만 추린 것
   ============================================================= */
(function () {
  "use strict";

  var DATA_URL = "assets/data/defense/points.json";
  var EQ_COLOR = "#f59e0b", EQ_EDGE = "#92400e";
  var DEF_COLOR = "#dc2626", DEF_EDGE = "#7f1d1d";
  var GG_CENTER = [37.42, 127.1], GG_ZOOM = 9;

  var doc = null;
  var map1 = null, map2 = null;
  var coLayers = {};          // 지도① 분야별 레이어
  var eqLayer = null, defLayer = null, coOverlay = null;
  var eqMode = "all";

  /* ---------- 유틸 ---------- */
  function num(n) { return Number(n).toLocaleString("ko-KR"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function busy(id, msg) {
    var b = document.getElementById(id);
    if (!b) return;
    if (msg == null) { b.hidden = true; return; }
    b.hidden = false; b.textContent = msg;
  }
  function baseMap(id) {
    var m = L.map(id, { preferCanvas: true, scrollWheelZoom: true }).setView(GG_CENTER, GG_ZOOM);
    /* CARTO 는 열쇠를 요구해 「API KEY REQUIRED」 도장이 찍힙니다 — Esri 로 바꿉니다 */
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Esri · HERE · OpenStreetMap contributors'
    }).addTo(m);
    L.control.scale({ imperial: false }).addTo(m);
    return m;
  }
  function fitTo(map, items) {
    if (!items.length) return;
    map.fitBounds(L.latLngBounds(items.map(function (d) { return [d.lat, d.lon]; })).pad(0.06));
  }

  /* ---------- 지도 ① 방산기업 ---------- */
  function coPopup(d) {
    return "<strong>" + esc(d.name) + "</strong><br>" +
           '<span style="color:#6b6360">' + esc(d.cat) + "</span><br>" +
           esc(d.addr || [d.si, d.sgg, d.emd].filter(Boolean).join(" "));
  }

  function buildCompanies() {
    var c = doc.companies, colorOf = {};
    c.cats.forEach(function (x) { colorOf[x.key] = x.color; });

    document.getElementById("dc-co-src").textContent = "기업 " + num(c.n) + "개사";
    document.getElementById("dc-co-note").textContent = c.note;

    c.cats.forEach(function (cat) {
      var items = c.items.filter(function (d) { return d.cat === cat.key; });
      var g = L.featureGroup(items.map(function (d) {
        return L.circleMarker([d.lat, d.lon], {
          radius: 6, color: "#fff", weight: 1.2, opacity: 1,
          fillColor: cat.color, fillOpacity: 0.92
        }).bindPopup(coPopup(d));
      }));
      coLayers[cat.key] = g;
      g.addTo(map1);
    });
    fitTo(map1, c.items);

    document.getElementById("dc-co-layers").innerHTML =
      '<fieldset><legend>기업 분야</legend>' + c.cats.map(function (cat) {
        return '<label class="fb-check"><input type="checkbox" data-cat="' + esc(cat.key) + '" checked>' +
               '<span class="sw" style="border-radius:50%;background:' + cat.color + '"></span>' +
               esc(cat.key) + ' <span style="color:#8b8280">' + num(cat.n) + "</span></label>";
      }).join("") + "</fieldset>";

    document.querySelectorAll("[data-cat]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var g = coLayers[cb.dataset.cat];
        if (!g) return;
        if (cb.checked) g.addTo(map1); else map1.removeLayer(g);
      });
    });

    document.getElementById("dc-legend1").innerHTML = c.cats.map(function (cat) {
      return '<div><i style="background:' + cat.color + '"></i>' + esc(cat.key) + "</div>";
    }).join("");

    busy("dc-busy1", null);
  }

  /* ---------- 지도 ② 연구장비 ---------- */
  function rOf(n) { return Math.max(4, Math.min(26, Math.sqrt(n) * 2.4)); }

  function eqPopup(d) {
    return "<strong>" + esc(d.org) + "</strong><br>" +
           "장비 " + num(d.n) + "대" + (d.orgs > 1 ? " · 기관 " + d.orgs + "곳" : "") +
           (d.field ? " · " + esc(d.field) : "") + "<br>" + esc(d.addr);
  }
  function defPopup(d) {
    var by = Object.keys(d.by || {}).map(function (k) {
      return esc(k) + " " + d.by[k];
    }).join("<br>");
    return "<strong>" + esc(d.org) + "</strong><br>" +
           "방산 관련 장비 " + num(d.n) + "대<br>" +
           '<span style="color:#6b6360">' + esc(d.cat) + "</span>" +
           (by ? "<hr style='border:0;border-top:1px solid #eee;margin:.4rem 0'>" + by : "") +
           "<br>" + esc(d.addr);
  }

  function markerGroup(items, color, edge, popup) {
    return L.featureGroup(items.map(function (d) {
      return L.circleMarker([d.lat, d.lon], {
        radius: rOf(d.n), color: edge, weight: 1, opacity: 0.9,
        fillColor: color, fillOpacity: 0.5
      }).bindPopup(popup(d));
    }));
  }

  function buildEquip() {
    var e = doc.equip, f = doc.defense;
    eqLayer = markerGroup(e.items, EQ_COLOR, EQ_EDGE, eqPopup);
    defLayer = markerGroup(f.items, DEF_COLOR, DEF_EDGE, defPopup);

    coOverlay = L.featureGroup(doc.companies.items.map(function (d) {
      var col = (doc.companies.cats.filter(function (x) { return x.key === d.cat; })[0] || {}).color || "#78716c";
      return L.circleMarker([d.lat, d.lon], {
        radius: 4, color: "#fff", weight: 1, fillColor: col, fillOpacity: 0.95
      }).bindPopup(coPopup(d));
    }));

    setEqMode("all");
    fitTo(map2, e.items);
    busy("dc-busy2", null);
  }

  function setEqMode(mode) {
    eqMode = mode;
    var e = doc.equip, f = doc.defense;
    if (map2.hasLayer(eqLayer)) map2.removeLayer(eqLayer);
    if (map2.hasLayer(defLayer)) map2.removeLayer(defLayer);
    (mode === "all" ? eqLayer : defLayer).addTo(map2);
    if (coOverlay && map2.hasLayer(coOverlay)) coOverlay.bringToFront();

    var cur = mode === "all" ? e : f;
    document.getElementById("dc-eq-src").textContent =
      cur.n + "곳 · 장비 " + num(cur.total) + "대";
    document.getElementById("dc-eq-note").textContent = cur.note;

    var col = mode === "all" ? EQ_COLOR : DEF_COLOR;
    var edge = mode === "all" ? EQ_EDGE : DEF_EDGE;
    document.getElementById("dc-legend2").innerHTML =
      '<div><span class="sz" style="width:9px;height:9px;background:' + col + '88;border-color:' + edge + '"></span>' +
        (mode === "all" ? "장비 5대" : "장비 3대") + " 안팎</div>" +
      '<div><span class="sz" style="width:17px;height:17px;background:' + col + '88;border-color:' + edge + '"></span>' +
        (mode === "all" ? "50대" : "20대") + " 안팎</div>" +
      '<div><span class="sz" style="width:26px;height:26px;background:' + col + '88;border-color:' + edge + '"></span>' +
        (mode === "all" ? "120대 이상" : "60대 이상") + "</div>";

    document.querySelectorAll("[data-eq]").forEach(function (b) {
      var on = b.dataset.eq === mode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  /* ---------- ③ 통계 ---------- */
  function bars(mountId, rows, color) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.n; })) || 1;
    document.getElementById(mountId).innerHTML = rows.map(function (r) {
      return '<div class="fb-bar"><span class="fb-bar__name" title="' + esc(r.label || r.key) + '">' +
             esc(r.label || r.key) + '</span>' +
             '<span class="fb-bar__track"><span class="fb-bar__fill" style="width:' +
             (r.n / max * 100).toFixed(1) + "%;background:" + (r.color || color) + '"></span></span>' +
             '<span class="fb-bar__val">' + num(r.n) + "</span></div>";
    }).join("");
  }

  function buildStats() {
    bars("dc-bar-cat", doc.companies.cats.map(function (c) {
      return { key: c.key, n: c.n, color: c.color };
    }), "#4f9d92");

    bars("dc-bar-dcat", doc.stats.byDefenseCat.map(function (c) {
      return { key: c.key, n: c.n };
    }), DEF_COLOR);

    document.getElementById("dc-sgg").innerHTML = doc.stats.bySi.map(function (r) {
      return "<tr><td>" + esc(r.si) + "</td><td>" + (r.co ? num(r.co) : "–") +
             "</td><td>" + (r.eq ? num(r.eq) : "–") + "</td></tr>";
    }).join("");

    document.getElementById("dc-meta").innerHTML =
      "<dt>기업</dt><dd>" + esc(doc.companies.label) + " · " + num(doc.companies.n) + "개사</dd>" +
      "<dt>연구장비</dt><dd>2025 경기도 연구장비 데이터 · " + num(doc.equip.total) +
        "대 / " + num(doc.equip.n) + "곳<br>이 가운데 방산 관련 " + num(doc.defense.total) +
        "대 / " + num(doc.defense.n) + "곳</dd>" +
      "<dt>지오코딩</dt><dd>카카오·네이버 주소 검색 결과(도로명 우선, 실패 시 지번)</dd>";
  }

  /* ---------- 시작 ---------- */
  function start() {
    if (!document.getElementById("dc-map1")) return;
    map1 = baseMap("dc-map1");
    map2 = baseMap("dc-map2");

    busy("dc-busy1", "자료를 불러오는 중입니다…");
    busy("dc-busy2", "자료를 불러오는 중입니다…");

    // 비공개 보관함(analysis)에서 받습니다 — 승인된 분만 열 수 있습니다
    import("../../auth/auth.js")
      .then(function (m) { return m.loadAnalysisJson("defense/points.json"); })
      .then(function (j) {
        doc = j;
        buildCompanies();
        buildEquip();
        buildStats();
      })
      .catch(function (err) {
        console.error(err);
        var msg = "자료를 불러오지 못했습니다: " + err.message +
                  (location.protocol === "file:" ? " — 웹서버(preview.cmd)로 열어 주세요." : "");
        busy("dc-busy1", msg); busy("dc-busy2", msg);
      });

    document.querySelectorAll("[data-eq]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.dataset.eq !== eqMode) setEqMode(b.dataset.eq);
      });
    });
    document.getElementById("dc-eq-co").addEventListener("change", function () {
      if (!coOverlay) return;
      if (this.checked) { coOverlay.addTo(map2); coOverlay.bringToFront(); }
      else map2.removeLayer(coOverlay);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
