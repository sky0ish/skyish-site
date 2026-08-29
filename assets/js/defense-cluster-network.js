/* =============================================================
   [경기도 방위산업 기업체와 연구장비] — ④ 네트워크
   defense-cluster.html 의 네 번째 그림.

   자료: assets/data/defense/network.json
     companies  경기도 사업장이 확인된 방산기업
     sites      방산 관련 연구장비 보유기관
     edges      기업 → 기관 (분야 적합 + 가까운 순 K곳)

   실제 거래가 아니라 '쓸 만한 장비가 어디 있는가'를 추정한 연결이다.
   ============================================================= */
(function () {
  "use strict";

  var URL = "assets/data/defense/network.json";
  var SITE_COLOR = "#fbbf24";        // 연구장비 기관
  var DIM = 0.1, LIT = 0.85;         // 평소 / 선택됐을 때 선 투명도
  var GG_CENTER = [37.42, 127.1], GG_ZOOM = 9;

  var doc = null, map = null, canvas = null;
  var arcs = [], coMarks = {}, stMarks = {};
  var colorOf = {}, active = null, shownCats = null;

  /* ---------- 유틸 ---------- */
  function num(n) { return Number(n).toLocaleString("ko-KR"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function busy(msg) {
    var b = document.getElementById("dc-busy4");
    if (!b) return;
    if (msg == null) { b.hidden = true; return; }
    b.hidden = false; b.textContent = msg;
  }

  /* 두 점을 잇는 부드러운 호(2차 베지어). 참고 지도의 아치 모양을 흉내낸다. */
  function arcPoints(a, b) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dy * dy) || 1e-9;
    // 중점에서 수직으로 밀어 곡률을 준다(짧은 선은 거의 직선)
    var k = Math.min(0.28, 0.16 + len * 0.6);
    var cx = mx - dy * k, cy = my + dx * k;
    var pts = [], n = 22;
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0],
                u * u * a[1] + 2 * u * t * cy + t * t * b[1]]);
    }
    return pts;
  }

  /* ---------- 그리기 ---------- */
  function draw() {
    var byId = {};
    doc.companies.forEach(function (c) { byId[c.id] = c; });
    doc.sites.forEach(function (s) { byId[s.id] = s; });
    doc.cats.forEach(function (c) { colorOf[c.key] = c.color; });

    // 선(호) — 기업 분야 색
    doc.edges.forEach(function (e) {
      var c = byId[e.c], s = byId[e.s];
      if (!c || !s) return;
      var line = L.polyline(arcPoints([c.lat, c.lon], [s.lat, s.lon]), {
        renderer: canvas, color: colorOf[c.cat] || "#94a3b8",
        weight: 1, opacity: DIM, interactive: false
      }).addTo(map);
      arcs.push({ line: line, c: c, s: s, e: e });
    });

    // 연구장비 기관 — 연결 수에 비례한 원
    doc.sites.forEach(function (s) {
      var m = L.circleMarker([s.lat, s.lon], {
        renderer: canvas,
        radius: Math.max(4, Math.min(17, 3.4 + Math.sqrt(s.deg) * 3)),
        // 경기도 밖 기관은 테두리를 흰 점선처럼 밝게 해 구분한다
        color: s.gg === "N" ? "#e7e5e4" : "#78350f",
        weight: s.gg === "N" ? 1.6 : 1, dashArray: s.gg === "N" ? "3 2" : null,
        fillColor: SITE_COLOR, fillOpacity: s.deg ? 0.85 : 0.3
      }).addTo(map);
      m.on("click", function () { select(s.id); });
      stMarks[s.id] = m;
    });

    // 기업
    doc.companies.forEach(function (c) {
      var m = L.circleMarker([c.lat, c.lon], {
        renderer: canvas, radius: 4.5,
        color: "#0b1220", weight: 1,
        fillColor: colorOf[c.cat] || "#94a3b8", fillOpacity: 0.95
      }).addTo(map);
      m.on("click", function () { select(c.id); });
      coMarks[c.id] = m;
    });

    map.fitBounds(L.latLngBounds(
      doc.companies.concat(doc.sites).map(function (d) { return [d.lat, d.lon]; })
    ).pad(0.05));
  }

  /* ---------- 선택 / 강조 ---------- */
  function select(id) {
    active = (active === id) ? null : id;
    refresh();
    panel();
  }

  function visible(a) {
    return !shownCats || shownCats[a.c.cat];
  }

  function refresh() {
    arcs.forEach(function (a) {
      var show = visible(a);
      var on = active && (a.c.id === active || a.s.id === active);
      a.line.setStyle({
        opacity: !show ? 0 : (active ? (on ? LIT : 0.03) : DIM),
        weight: on ? 2 : 1
      });
    });
    Object.keys(coMarks).forEach(function (id) {
      var c = coMarks[id], d = doc.companies.filter(function (x) { return x.id === id; })[0];
      var show = !shownCats || shownCats[d.cat];
      c.setStyle({ opacity: show ? 1 : 0, fillOpacity: show ? (active && active !== id ? 0.35 : 0.95) : 0 });
    });
    Object.keys(stMarks).forEach(function (id) {
      stMarks[id].setStyle({ fillOpacity: active && active !== id ? 0.35 : 0.85 });
    });
  }

  function panel() {
    var box = document.getElementById("dc-net-info");
    if (!active) {
      box.innerHTML = '<p class="fb-sub">점을 누르면 그 기업이 이용할 만한 연구장비 기관, ' +
                      '또는 그 기관을 이용할 만한 기업이 표시됩니다.</p>';
      return;
    }
    var lab = doc.catLabel || {};
    var co = doc.companies.filter(function (x) { return x.id === active; })[0];
    if (co) {
      var mine = arcs.filter(function (a) { return a.c.id === active; });
      box.innerHTML =
        '<h4><span class="dot" style="background:' + (colorOf[co.cat] || "#94a3b8") + '"></span>' +
        esc(co.name) + "</h4>" +
        '<p class="fb-sub">' + esc(co.rawCat) + (co.si ? " · " + esc(co.si) : "") + "</p>" +
        (co.addr ? '<p class="fb-sub">' + esc(co.addr) + "</p>" : "") +
        "<ul class='dc-net-list'>" + mine.map(function (a) {
          return "<li><b>" + esc(a.s.name) + "</b>" +
                 '<span class="km">' + a.e.km + "km</span><br>" +
                 '<span class="fb-sub">' + a.e.why.map(function (w) {
                   return esc(lab[w] || w);
                 }).join(" · ") + " — 해당 장비 " + num(a.e.n) + "대</span></li>";
        }).join("") + "</ul>";
      return;
    }
    var st = doc.sites.filter(function (x) { return x.id === active; })[0];
    if (!st) return;
    var users = arcs.filter(function (a) { return a.s.id === active; });
    box.innerHTML =
      '<h4><span class="dot" style="background:' + SITE_COLOR + '"></span>' + esc(st.name) +
      (st.gg === "N" ? ' <span class="tag-out">경기도 밖</span>' : "") + "</h4>" +
      '<p class="fb-sub">방산 관련 장비 ' + num(st.n) + "대" +
        (st.si ? " · " + esc(st.si) : "") + "</p>" +
      (st.addr ? '<p class="fb-sub">' + esc(st.addr) + "</p>" : "") +
      '<p class="fb-sub" style="margin-top:.5rem">보유 유형: ' +
        Object.keys(st.by).map(function (k) {
          return esc(k) + " " + st.by[k] + "대";
        }).join(" / ") + "</p>" +
      "<ul class='dc-net-list'><li class='hd'>이 기관과 이어진 기업 " + users.length + "개사</li>" +
      users.sort(function (a, b) { return a.e.km - b.e.km; }).map(function (a) {
        return "<li><b>" + esc(a.c.name) + "</b><span class='km'>" + a.e.km + "km</span><br>" +
               '<span class="fb-sub">' + esc(a.c.rawCat) + "</span></li>";
      }).join("") + "</ul>";
  }

  /* ---------- 조작 UI ---------- */
  function controls() {
    var m = doc.meta;
    document.getElementById("dc-net-src").textContent =
      "기업 " + num(m.linkedCo) + "개사 · 기관 " + num(m.linkedSite) + "곳 · 연결 " + num(m.nEdge) + "개";
    document.getElementById("dc-net-note").textContent = m.note;

    shownCats = {};
    doc.cats.forEach(function (c) { shownCats[c.key] = true; });

    document.getElementById("dc-net-layers").innerHTML =
      '<fieldset><legend>기업 분야</legend>' + doc.cats.map(function (c) {
        return '<label class="fb-check"><input type="checkbox" data-ncat="' + esc(c.key) + '" checked>' +
               '<span class="sw" style="border-radius:50%;background:' + c.color + '"></span>' +
               esc(c.key) + ' <span style="color:#8b8280">' + num(c.n) + "</span></label>";
      }).join("") +
      '</fieldset><fieldset><legend>보기</legend>' +
      '<button type="button" class="chip" id="dc-net-reset">선택 해제</button></fieldset>';

    document.querySelectorAll("[data-ncat]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        shownCats[cb.dataset.ncat] = cb.checked;
        refresh();
      });
    });
    document.getElementById("dc-net-reset").addEventListener("click", function () {
      active = null; refresh(); panel();
    });

    document.getElementById("dc-legend4").innerHTML =
      doc.cats.map(function (c) {
        return '<div><i style="background:' + c.color + '"></i>' + esc(c.key) + "</div>";
      }).join("") +
      '<div><i style="background:' + SITE_COLOR + ';border-radius:50%"></i>연구장비 기관</div>' +
      (doc.meta.outGg
        ? '<div><i style="background:' + SITE_COLOR +
          ';border-radius:50%;box-shadow:0 0 0 1.5px #e7e5e4"></i>경기도 밖 (' +
          doc.meta.outGg + "곳)</div>"
        : "");
  }

  /* ---------- 시작 ---------- */
  function start() {
    var el = document.getElementById("dc-map4");
    if (!el) return;
    map = L.map("dc-map4", { preferCanvas: true, scrollWheelZoom: true })
           .setView(GG_CENTER, GG_ZOOM);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    canvas = L.canvas({ padding: 0.4 });

    busy("자료를 불러오는 중입니다…");
    // 배포본(단독 폴더)에서는 자료를 파일에 박아두므로 fetch 없이 바로 그린다
    var pre = window.DC_NETWORK_DATA
      ? Promise.resolve(window.DC_NETWORK_DATA)
      : import("./auth/auth.js").then(function (m) {
          return m.loadAnalysisJson("defense/network.json");
        });
    pre
      .then(function (j) {
        doc = j;
        controls();
        draw();
        refresh();
        panel();
        busy(null);
      })
      .catch(function (err) {
        console.error(err);
        busy("자료를 불러오지 못했습니다: " + err.message +
             (location.protocol === "file:" ? " — 웹서버(preview.cmd)로 열어 주세요." : ""));
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
