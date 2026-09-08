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

  /* ══════════════════════════════════════════════════════════
     텍스트마이닝 — 장비 이름에서 뽑은 「기능 키워드」로 본 연결

       기업 ──(분야가 필요로 하는 시험)── 기관 ──(가진 장비의 이름)── 키워드

     키워드는 장비의 한글·영문 이름과 활용분야 글에서 뽑았습니다.
     자료는 network.json 의 kw 칸에 들어 있습니다 (build_defense_network.py).
     ══════════════════════════════════════════════════════════ */
  var tmKw = null, tmSite = null;

  function tmData() { return doc && doc.kw ? doc.kw : null; }

  /** 그 키워드 장비를 가진 기관들 — 장비 많은 곳부터 */
  function tmSites(key) {
    var kw = tmData(); if (!kw) return [];
    return doc.sites.filter(function (s) {
      var b = kw.bySite[s.id];
      return b && b[key];
    }).sort(function (a, b) {
      return kw.bySite[b.id][key] - kw.bySite[a.id][key] ||
             String(a.name).localeCompare(String(b.name), "ko");
    });
  }

  /** 그 기관들과 이어진 기업 — 가까운 것부터. 같은 기업은 한 번만. */
  function tmCos(sites) {
    var want = {}, out = [], seen = {};
    sites.forEach(function (s) { want[s.id] = 1; });
    arcs.filter(function (a) { return want[a.s.id]; })
        .sort(function (a, b) { return a.e.km - b.e.km; })
        .forEach(function (a) {
          if (seen[a.c.id]) return;
          seen[a.c.id] = 1;
          out.push({ co: a.c, site: a.s, km: a.e.km });
        });
    return out;
  }

  function tmChips() {
    var kw = tmData();
    var box = document.getElementById("dc-tm-chips");
    if (!box) return;
    if (!kw) {
      box.innerHTML = '<span class="fb-fig__src">장비 키워드 자료가 없습니다 — ' +
        'network.json 을 새로 올려 주세요.</span>';
      var note0 = document.getElementById("dc-tm-note");
      if (note0) note0.textContent =
        "이 칸은 network.json 의 kw 자료가 있어야 그려집니다.";
      return;
    }
    box.innerHTML = '<fieldset><legend>장비 기능</legend>' +
      kw.groups.map(function (g) {
        return '<button type="button" class="chip" data-kw="' + esc(g.key) + '"' +
               (g.key === tmKw ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' +
               esc(g.label) + ' <span class="n">' + num(g.n) + "</span></button>";
      }).join("") + "</fieldset>";
    box.querySelectorAll("[data-kw]").forEach(function (b) {
      b.addEventListener("click", function () {
        tmKw = (tmKw === b.dataset.kw) ? null : b.dataset.kw;
        tmSite = null;
        tmDraw();
      });
    });
    var note = document.getElementById("dc-tm-note");
    if (note) note.textContent = kw.note;
  }

  function tmDraw() {
    var kw = tmData(); if (!kw) return;
    document.querySelectorAll("[data-kw]").forEach(function (b) {
      var on = b.dataset.kw === tmKw;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    var elS = document.getElementById("dc-tm-sites");
    var elC = document.getElementById("dc-tm-cos");
    var elE = document.getElementById("dc-tm-eq");
    var nS = document.getElementById("dc-tm-sn");
    var nC = document.getElementById("dc-tm-cn");
    var nE = document.getElementById("dc-tm-en");

    if (!tmKw) {
      nS.textContent = nC.textContent = nE.textContent = "위에서 장비 기능을 하나 골라 주세요.";
      elS.innerHTML = elC.innerHTML = elE.innerHTML = "";
      return;
    }
    var lab = (kw.groups.filter(function (g) { return g.key === tmKw; })[0] || {}).label || tmKw;
    var sites = tmSites(tmKw);
    if (tmSite && !sites.some(function (s) { return s.id === tmSite; })) tmSite = null;

    /* ① 기관 */
    nS.textContent = esc(lab) + " 장비를 가진 " + sites.length + "곳";
    elS.innerHTML = sites.map(function (s) {
      return '<li class="' + (s.id === tmSite ? "on" : "") + '">' +
             '<button type="button" data-tsite="' + esc(s.id) + '">' +
             "<b>" + esc(s.name) + "</b>" +
             (s.gg === "N" ? ' <span class="tag-out">경기도 밖</span>' : "") +
             '<span class="km">' + num(kw.bySite[s.id][tmKw]) + "대</span><br>" +
             /* 같은 이름의 기관이 주소만 다르게 여럿 있습니다 (예: 키엘연구원 두 곳) —
                소재지가 비면 주소를 보여 주어야 어느 쪽인지 알 수 있습니다 */
             '<span class="fb-sub">' + esc(s.si || s.addr || "") +
             " · 이어진 기업 " + num(s.deg) + "개사</span></button></li>";
    }).join("");
    elS.querySelectorAll("[data-tsite]").forEach(function (b) {
      b.addEventListener("click", function () {
        tmSite = (tmSite === b.dataset.tsite) ? null : b.dataset.tsite;
        tmDraw();
      });
    });

    /* ② 기업 — 기관을 고르면 그 한 곳과 이어진 기업만 */
    var pick = tmSite ? sites.filter(function (s) { return s.id === tmSite; }) : sites;
    var cos = tmCos(pick);
    nC.textContent = tmSite
      ? (pick[0] ? esc(pick[0].name) + " 와 이어진 " + cos.length + "개사" : "")
      : esc(lab) + " 로 이어지는 " + cos.length + "개사";
    elC.innerHTML = cos.map(function (x) {
      return "<li><b>" + esc(x.co.name) + "</b>" +
             '<span class="km">' + x.km + "km</span><br>" +
             '<span class="fb-sub"><span class="dot" style="display:inline-block;' +
             "background:" + (colorOf[x.co.cat] || "#94a3b8") + '"></span> ' +
             esc(x.co.rawCat || x.co.cat) +
             (tmSite ? "" : " → " + esc(x.site.name)) + "</span></li>";
    }).join("") || '<li class="hd">이어진 기업이 없습니다.</li>';

    /* ③ 장비 — 그 키워드로 걸린 실제 장비 이름 */
    var names = [];
    pick.forEach(function (s) {
      ((kw.eg[s.id] || {})[tmKw] || []).forEach(function (nm) {
        names.push({ nm: nm, site: s.name });
      });
    });
    nE.textContent = esc(lab) + " 로 걸린 장비 " + names.length + "대";
    elE.innerHTML = names.map(function (x) {
      return "<li><b>" + esc(x.nm) + "</b>" +
             (tmSite ? "" : '<br><span class="fb-sub">' + esc(x.site) + "</span>") + "</li>";
    }).join("") || '<li class="hd">장비 이름이 없습니다.</li>';
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
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Esri · HERE · OpenStreetMap contributors'
    }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    canvas = L.canvas({ padding: 0.4 });

    busy("자료를 불러오는 중입니다…");
    // 배포본(단독 폴더)에서는 자료를 파일에 박아두므로 fetch 없이 바로 그린다
    var pre = window.DC_NETWORK_DATA
      ? Promise.resolve(window.DC_NETWORK_DATA)
      : import("../../auth/auth.js").then(function (m) {
          return m.loadAnalysisJson("defense/network.json");
        });
    pre
      .then(function (j) {
        doc = j;
        controls();
        draw();
        refresh();
        panel();
        tmChips();
        tmDraw();
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
