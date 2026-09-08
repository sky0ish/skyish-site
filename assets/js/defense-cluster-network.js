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
  var pieMap = null, pieOn = {}, pieMarks = [];   // ② 파이 지도
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
      /* 지도는 그려졌는데 kw 만 없다는 것은 **옛 network.json 이 그대로**라는 뜻입니다.
         「올렸는데 안 나온다」 는 대개 defense 폴더 밖에 올라갔거나 덮어쓰기가
         안 된 것이라, 보관함 안을 직접 보여 주는 편이 빠릅니다. */
      box.innerHTML = '<span class="fb-fig__src">장비 키워드 자료가 없습니다 — ' +
        '보관함을 확인하는 중…</span>';
      var note0 = document.getElementById("dc-tm-note");
      if (note0) note0.textContent =
        "지금 읽은 network.json 에는 장비 키워드(kw)가 없습니다 — 옛 파일로 보입니다.";
      import("../../auth/auth.js").then(function (m) {
        var st = m.sb.storage.from("analysis");
        return Promise.all([st.list("defense", { limit: 100 }), st.list("", { limit: 100 })])
          .then(function (r) {
            var say = function (x) {
              return (((x || {}).data) || []).map(function (f) { return f.name; });
            };
            var 안 = say(r[0]), 밖 = say(r[1]);
            var code = function (a) {
              return a.length ? "<code>" + a.map(esc).join("</code> · <code>") + "</code>"
                              : "(비어 있음)";
            };
            box.innerHTML = '<span class="fb-fig__src">' +
              'analysis / <b>defense</b> 폴더: ' + code(안) + '<br>' +
              'analysis 맨 위: ' + code(밖) + '<br>' +
              (밖.indexOf("network.json") >= 0 || 밖.indexOf("companies.json") >= 0
                ? '<b>파일이 defense 폴더 <u>밖</u>에 올라가 있습니다.</b> ' +
                  'defense 폴더 안으로 옮겨 주세요.'
                : '새 network.json 으로 <b>덮어쓰기</b>가 되었는지 봐 주세요.') +
              "</span>";
          });
      }).catch(function (e) {
        box.innerHTML = '<span class="fb-fig__src">장비 키워드 자료가 없습니다 — ' +
          'network.json 을 새로 올려 주세요. (보관함은 확인하지 못했습니다: ' +
          esc(String((e && e.message) || "까닭 모름")) + ")</span>";
      });
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
        /* 아래 목록과 위 관계망을 함께 걸러 줍니다 — 따로 놀면 헷갈립니다 */
        try { if (window.DC_GRAPH) window.DC_GRAPH.filter(tmKw); } catch (e) { console.error(e); }
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

  /* ══════════════════════════════════════════════════════════
     ② 방산 관련 연구장비 — 시군별 분포와 시험 유형 (파이 지도)

       원의 **넓이**가 그 지점의 장비 수, 조각이 시험 유형별 구성비입니다.
       result_py/04_방위산업_관련장비_지도.py 가 그린 그림과 같은 규칙·같은 색인데,
       여기서는 확대할 수 있고 눌러서 내역을 볼 수 있습니다.
       자료는 network.json 의 sites — 기관마다 by:{유형:대수} 를 가지고 있습니다.
     ══════════════════════════════════════════════════════════ */

  /* 색은 그림을 그린 파이썬과 같은 값입니다 (04_방위산업_관련장비_지도.py 의 COLORS).
     network.json 에 담지 않은 까닭은, 색을 바꾸자고 자료를 다시 올리실 일이
     없게 하려는 것입니다. */
  var PIE_COLOR = {
    A: "#C1272D", B: "#E8833A", C: "#2D6CB5", D: "#3E8E5A",
    E: "#8B5FBF", F: "#6B7A88", G: "#00868B"
  };
  var PIE_KEYS = ["A", "B", "C", "D", "E", "F", "G"];

  /** 「B. 환경내구성 시험」 → "B" */
  function pieKey(name) {
    var m = /^([A-G])\./.exec(String(name || "").trim());
    return m ? m[1] : "";
  }

  /** 켜 둔 유형만 남긴 내역 — [[열쇠, 대수]…] 과 합계 */
  function pieParts(site) {
    var out = [], sum = 0;
    PIE_KEYS.forEach(function (k) {
      if (!pieOn[k]) return;
      var n = 0;
      Object.keys(site.by || {}).forEach(function (nm) {
        if (pieKey(nm) === k) n += site.by[nm];
      });
      if (n > 0) { out.push([k, n]); sum += n; }
    });
    return { parts: out, sum: sum };
  }

  /** 원 하나를 조각내어 그린 SVG — 한 조각뿐이면 그냥 동그라미 */
  function pieSvg(parts, sum, r) {
    var d = r * 2 + 4, c = r + 2;                 // 테두리 몫으로 2px 씩
    var svg = '<svg width="' + d + '" height="' + d + '" viewBox="0 0 ' + d + ' ' + d + '">';
    if (parts.length === 1) {
      svg += '<circle cx="' + c + '" cy="' + c + '" r="' + r +
             '" fill="' + PIE_COLOR[parts[0][0]] + '" stroke="#fff" stroke-width="1.2"/>';
    } else {
      var a0 = -Math.PI / 2;                      // 12시부터 시계 방향
      parts.forEach(function (pt) {
        var a1 = a0 + (pt[1] / sum) * Math.PI * 2;
        var big = (a1 - a0) > Math.PI ? 1 : 0;
        var x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0);
        var x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
        svg += '<path d="M' + c + " " + c + " L" + x0.toFixed(2) + " " + y0.toFixed(2) +
               " A" + r + " " + r + " 0 " + big + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2) +
               ' Z" fill="' + PIE_COLOR[pt[0]] + '" stroke="#fff" stroke-width="1"/>';
        a0 = a1;
      });
    }
    svg += '<circle cx="' + c + '" cy="' + c + '" r="' + r +
           '" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/></svg>';
    return svg;
  }

  /** 원의 넓이가 장비 수에 비례하도록 — 너무 작아 안 보이지 않게 아래를 받칩니다 */
  function pieR(n) { return Math.max(6, Math.min(30, 3.1 * Math.sqrt(n))); }

  function piePopup(site, parts, sum) {
    var lab = doc.catLabel || {};
    return "<strong>" + esc(site.name) + "</strong>" +
      (site.gg === "N" ? ' <span class="tag-out">경기도 밖</span>' : "") + "<br>" +
      "방산 관련 장비 " + num(sum) + "대" +
      (sum !== site.n ? ' <span style="color:#8b8280">(전체 ' + num(site.n) +
        "대 중 켜 둔 유형만)</span>" : "") +
      (site.si ? " · " + esc(site.si) : "") +
      "<hr style='border:0;border-top:1px solid #eee;margin:.4rem 0'>" +
      parts.map(function (pt) {
        return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;' +
               "background:" + PIE_COLOR[pt[0]] + ';margin-right:.4rem"></span>' +
               esc(pt[0] + ". " + (lab[pt[0]] || "")) + " " + num(pt[1]) + "대";
      }).join("<br>") +
      (site.addr ? '<br><span style="color:#6b6360">' + esc(site.addr) + "</span>" : "");
  }

  function pieDraw() {
    if (!pieMap) return;
    pieMarks.forEach(function (m) { pieMap.removeLayer(m); });
    pieMarks = [];
    var nSite = 0, nUnit = 0;
    /* 작은 원이 큰 원에 묻히지 않게 큰 것부터 놓습니다 */
    doc.sites.slice().sort(function (a, b) { return b.n - a.n; }).forEach(function (site) {
      var got = pieParts(site);
      if (!got.sum) return;
      var r = pieR(got.sum);
      var m = L.marker([site.lat, site.lon], {
        icon: L.divIcon({
          className: "dc-pie", html: pieSvg(got.parts, got.sum, r),
          iconSize: [r * 2 + 4, r * 2 + 4], iconAnchor: [r + 2, r + 2]
        }),
        /* 큰 원이 위에 오면 작은 원을 못 누릅니다 — 작을수록 앞으로 */
        zIndexOffset: Math.round(1000 - r * 10)
      }).bindPopup(piePopup(site, got.parts, got.sum));
      m.addTo(pieMap);
      pieMarks.push(m);
      nSite++; nUnit += got.sum;
    });
    document.getElementById("dc-legend5").innerHTML =
      "<b>시험 유형 · 조각이 구성비</b>" +
      PIE_KEYS.filter(function (k) { return pieOn[k]; }).map(function (k) {
        return '<div><i class="pie" style="background:' + PIE_COLOR[k] + '"></i>' +
               esc(k + ". " + ((doc.catLabel || {})[k] || "")) + "</div>";
      }).join("") +
      "<hr><b>원 넓이 ∝ 장비 수</b>" +
      [1, 23, 92].map(function (n) {
        var d = Math.round(pieR(n) * 2);
        return '<div><span class="sz" style="width:' + d + "px;height:" + d +
               'px;background:#cfd4da;border-color:#8b8280"></span>' + n + "대</div>";
      }).join("");
    var src = document.getElementById("dc-pie-src");
    if (src) src.textContent = num(nUnit) + "대 · " + nSite + "개 지점";
  }

  function pieBuild() {
    var el = document.getElementById("dc-map5");
    if (!el || !doc || !doc.sites) return;
    pieMap = L.map("dc-map5", { preferCanvas: false, scrollWheelZoom: true })
              .setView(GG_CENTER, GG_ZOOM);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Esri · HERE · OpenStreetMap contributors"
    }).addTo(pieMap);
    L.control.scale({ imperial: false }).addTo(pieMap);

    PIE_KEYS.forEach(function (k) { pieOn[k] = true; });

    /* 유형별 합계는 자료에서 셉니다 — 화면에 적어 둔 숫자가 자료와 어긋나면 안 됩니다 */
    var tot = {};
    doc.sites.forEach(function (s2) {
      Object.keys(s2.by || {}).forEach(function (nm) {
        var k = pieKey(nm);
        if (k) tot[k] = (tot[k] || 0) + s2.by[nm];
      });
    });
    var lab = doc.catLabel || {};
    document.getElementById("dc-pie-cats").innerHTML =
      '<fieldset><legend>시험 유형</legend>' +
      PIE_KEYS.filter(function (k) { return tot[k]; }).map(function (k) {
        return '<label class="fb-check"><input type="checkbox" data-pcat="' + k + '" checked>' +
               '<span class="sw" style="border-radius:50%;background:' + PIE_COLOR[k] + '"></span>' +
               esc(k + ". " + (lab[k] || "")) +
               ' <span style="color:#8b8280">' + num(tot[k]) + "</span></label>";
      }).join("") + "</fieldset>";
    document.querySelectorAll("[data-pcat]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        pieOn[cb.dataset.pcat] = cb.checked;
        pieDraw();
      });
    });

    pieDraw();
    var b = document.getElementById("dc-busy5");
    if (b) b.hidden = true;
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
        /* ② 파이 지도도 같은 network.json 을 씁니다.
           여기서 무슨 일이 나도 아래 네트워크·텍스트마이닝이 멎으면 안 됩니다. */
        try { pieBuild(); } catch (e) { console.error(e); }
        tmChips();
        tmDraw();
        /* 관계망 그림 — 같은 network.json 을 씁니다.
           여기서 무슨 일이 나도 위 지도와 아래 목록은 그대로여야 합니다. */
        try {
          if (window.DC_GRAPH) window.DC_GRAPH.init(doc, colorOf);
        } catch (e) { console.error(e); }
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
