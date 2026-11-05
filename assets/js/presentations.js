/* ------------------------------------------------------------------
   Presentations 게시판 — presentations.html

   ● 위: 발표 목록
       낱말 찾기(제목·행사·장소·주최·함께한 분·프로그램·기관), 갈래 단추, 연도, ▶ 유튜브만
       · 제목 → talk.html?k=<sort> (행사 개요)
       · ▶ 유튜브 → 그 영상(YouTube)으로 바로
       · 주소에 상태가 남습니다: presentations.html?q=국회&y=2025&yt=1&f=usfk&org=국토연구원
   ● 아래: 주제별 통계 (전체 발표 기준)
       분야별 발표 수 · 분야의 흐름(연도) · 자주 쓴 키워드 · 기관 연결망(텍스트마이닝)
   ● 맨 아래: 연구주제별 자문단 — 로그인한 주인에게만 (일정의 회의·자문 기록까지 읽습니다)
       분석 규칙(분야 낱말·기관 별칭)은 assets/js/talk-stats.js 에 있습니다.

   데이터: assets/data/talks.js (window.TALKS) + assets/data/talk-info.json
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  var S = window.TalkStats;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var ytId = function (u) {
    var m = /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/live\/)([\w-]{11})/.exec(String(u || ""));
    return m ? m[1] : "";
  };
  var norm = function (s) { return String(s || "").toLowerCase().replace(/\s+/g, " "); };
  var tight = function (s) { return String(s || "").toLowerCase().replace(/[\s·ㆍ・\-—–_.,()「」『』'"‘’“”]/g, ""); };

  var TYPE_COLOR = { par: "#2a78d6", gov: "#eb6834", res: "#1baf7a", uni: "#eda100", pub: "#e87ba4", civ: "#008300" };
  var FIELD = {};
  S.FIELDS.forEach(function (f) { FIELD[f.id] = f; });
  var KIND = {};
  S.KINDS.forEach(function (k) { KIND[k.id] = k; });
  var TYPE = {};
  S.TYPES.forEach(function (t) { TYPE[t.id] = t; });

  var today = (function () { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); })();

  /* ── 데이터 묶기 ─────────────────────────────────────────── */
  var ITEMS = [];
  function build(talks, info) {
    ITEMS = talks.slice().sort(function (a, b) { return (b.sort || 0) - (a.sort || 0); }).map(function (t) {
      var I = info[String(t.sort)] || {};
      var vids = (I.links || []).filter(function (l) { return ytId(l.u); });
      var people = (I.people || []).filter(function (p) { return p && p.name; });
      var it = {
        t: t, I: I, k: String(t.sort), year: String(t.sort).slice(0, 4),
        kind: S.kindOf(t.tag), role: S.roleOf(t, I), vids: vids, soon: t.sort > today,
        fields: S.fieldsOf(t, I), orgs: S.orgsOf(t, I)
      };
      /* 찾기용 — [이름표, 글] */
      it.parts = [
        ["제목", t.title], ["행사", [t.host, I.event].filter(Boolean).join(" · ")], ["갈래", t.tag], ["역할", S.roleOf(t, I).name],
        ["날짜", t.date + " " + t.sort], ["장소", I.where], ["주최·주관", [I.host, I.org, I.support].filter(Boolean).join(" · ")],
        ["개요", I.about],
        ["발표 내용", I.talk ? [I.talk.title, I.talk.summary].concat(I.talk.points || [], I.talk.outline || []).filter(Boolean).join(" · ") : ""],
        ["키워드", I.talk && (I.talk.keywords || []).join(" ")]
      ].concat(people.map(function (p) { return ["함께한 분", p.name + " " + [p.title, p.org].filter(Boolean).join(" ")]; }))
       .concat((I.program || []).map(function (p) { return ["프로그램", [p.item, p.who].filter(Boolean).join(" — ")]; }))
       .concat(it.orgs.map(function (o) { return ["기관", o.name]; }))
       .concat(it.fields.map(function (f) { return ["분야", FIELD[f.id].name]; }))
       .filter(function (p) { return p[1]; })
       .map(function (p) { return { label: p[0], text: String(p[1]), n: norm(p[1]), w: tight(p[1]) }; });
      return it;
    });
  }

  /* ── 상태 (주소에 남김) ─────────────────────────────────── */
  var st = { q: "", g: "all", y: "all", r: "all", yt: false, f: "", kw: "", org: "" };
  (function () {
    var sp = new URLSearchParams(location.search);
    st.q = sp.get("q") || "";
    st.g = sp.get("g") || "all";
    st.y = sp.get("y") || "all";
    st.r = sp.get("r") || "all";
    st.yt = sp.get("yt") === "1";
    st.f = sp.get("f") || "";
    if (st.f === "defense") st.f = "usfk";   /* 방산·국방 AI 는 반환공여지와 한 분야로 합쳤습니다 */
    st.kw = sp.get("kw") || "";
    st.org = sp.get("org") || "";
  })();
  function saveState() {
    var sp = new URLSearchParams();
    if (st.q) sp.set("q", st.q);
    if (st.g !== "all") sp.set("g", st.g);
    if (st.y !== "all") sp.set("y", st.y);
    if (st.r !== "all") sp.set("r", st.r);
    if (st.yt) sp.set("yt", "1");
    if (st.f) sp.set("f", st.f);
    if (st.f && st.kw !== "") sp.set("kw", st.kw);
    if (st.org) sp.set("org", st.org);
    var s = sp.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }

  /* ── 거르기 ──────────────────────────────────────────────── */
  function terms() {
    return st.q.trim().split(/\s+/).filter(Boolean).map(function (w) { return { n: norm(w), w: tight(w) }; });
  }
  function partHit(p, tm) { return p.n.indexOf(tm.n) >= 0 || (tm.w && p.w.indexOf(tm.w) >= 0); }
  function matchQ(it, tms) {
    return tms.every(function (tm) { return it.parts.some(function (p) { return partHit(p, tm); }); });
  }
  function pass(it, skip) {
    if (skip !== "g" && st.g !== "all" && it.kind !== st.g) return false;
    if (skip !== "y" && st.y !== "all" && it.year !== st.y) return false;
    if (skip !== "r" && st.r !== "all" && it.role.id !== st.r) return false;
    if (skip !== "yt" && st.yt && !it.vids.length) return false;
    if (st.f) {
      var f = it.fields.filter(function (x) { return x.id === st.f; })[0];
      if (!f) return false;
      if (st.kw !== "" && f.kws.indexOf(+st.kw) < 0) return false;
    }
    if (st.org && !it.orgs.some(function (o) { return o.name === st.org; })) return false;
    return true;
  }

  /* ── 그리기: 게시판 ───────────────────────────────────────── */
  function hl(text, tms) {
    var h = esc(text);
    tms.forEach(function (tm) {
      if (!tm.n || tm.n.length < 1) return;
      var re = new RegExp("(" + esc(tm.n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      h = h.replace(re, "<mark>$1</mark>");
    });
    return h;
  }
  function whyHtml(it, tms) {
    if (!tms.length) return "";
    var shown = it.parts.filter(function (p) { return p.label === "제목" || p.label === "행사"; });
    var out = [];
    tms.forEach(function (tm) {
      if (shown.some(function (p) { return partHit(p, tm); })) return;
      var p = it.parts.filter(function (p) { return partHit(p, tm); })[0];
      if (!p) return;
      var txt = p.text, i = norm(txt).indexOf(tm.n);
      if (txt.length > 70) {
        var a = Math.max(0, (i < 0 ? 0 : i) - 24);
        txt = (a ? "…" : "") + txt.slice(a, a + 66) + (a + 66 < p.text.length ? "…" : "");
      }
      out.push("<b>" + esc(p.label) + "</b> " + hl(txt, [tm]));
    });
    return out.length ? '<span class="pb-why">찾은 곳 · ' + out.join(" / ") + "</span>" : "";
  }
  function ytChip(it) {
    if (!it.vids.length) return "";
    var v = it.vids[0];
    return '<a class="pb-yt" href="' + esc(v.u) + '" target="_blank" rel="noopener" title="유튜브에서 보기 — ' + esc(v.t || "") + '">▶ 유튜브' +
      (it.vids.length > 1 ? " " + it.vids.length : "") + "</a>";
  }
  function rowHtml(it, tms) {
    var t = it.t;
    return '<li class="pub pb-row">' +
      '<span class="pub__date">' + esc(t.date) + "</span>" +
      '<span class="pub__body">' +
        '<span class="pb-tl"><a class="pub__title" href="talk.html?k=' + encodeURIComponent(it.k) + '">' + hl(t.title, tms) +
          '<span class="pub__ext" aria-hidden="true">›</span></a>' + ytChip(it) +
          (it.soon ? '<span class="pb-soon">예정</span>' : "") + "</span>" +
        (t.host ? '<span class="pub__meta">' + hl(t.host, tms) + "</span>" : "") +
        whyHtml(it, tms) +
      "</span>" +
      '<span class="pb-side">' + (t.tag ? '<span class="pub__role">' + esc(t.tag) + "</span>" : "") +
        '<b class="pb-rl pb-rl--' + it.role.id + '" title="이 발표에서 맡은 역할">' + esc(it.role.name) + "</b></span>" +
    "</li>";
  }

  function drawBoard() {
    var tms = terms();
    var base = ITEMS.filter(function (it) { return matchQ(it, tms); });
    var pick = base.filter(function (it) { return pass(it); });

    /* 갈래 단추 (숫자는 다른 거르기를 반영) */
    var kc = { all: 0 };
    base.filter(function (it) { return pass(it, "g"); }).forEach(function (it) { kc.all++; kc[it.kind] = (kc[it.kind] || 0) + 1; });
    $("pbKinds").innerHTML = [["all", "전체"]].concat(S.KINDS.map(function (k) { return [k.id, k.name]; }))
      .filter(function (k) { return k[0] === "all" || kc[k[0]] || st.g === k[0]; })
      .map(function (k) {
        return '<a href="#" role="button" data-g="' + k[0] + '" class="' + (st.g === k[0] ? "on" : "") + '">' + esc(k[1]) +
          ' <span class="gtabs__n">' + (kc[k[0]] || 0) + "</span></a>";
      }).join("");

    /* 연도 · 유튜브 */
    var yc = {}, yAll = 0;
    base.filter(function (it) { return pass(it, "y"); }).forEach(function (it) { yAll++; yc[it.year] = (yc[it.year] || 0) + 1; });
    var ytN = base.filter(function (it) { return pass(it, "yt") && it.vids.length; }).length;
    var rc = {};
    base.filter(function (it) { return pass(it, "r"); }).forEach(function (it) { rc[it.role.id] = (rc[it.role.id] || 0) + 1; });
    $("pbRoles").innerHTML = '<span class="pb-lab">맡은 역할</span>' +
      '<button type="button" class="pb-chip' + (st.r === "all" ? " on" : "") + '" data-r="all">모두</button>' +
      S.ROLES.filter(function (r) { return rc[r.id] || st.r === r.id; }).map(function (r) {
        return '<button type="button" class="pb-chip pb-chip--rl' + (st.r === r.id ? " on" : "") + '" data-r="' + r.id + '">' +
          '<i class="pb-rl pb-rl--' + r.id + '">' + esc(r.name) + "</i> <b>" + (rc[r.id] || 0) + "</b></button>";
      }).join("");
    var ys = Object.keys(yc).sort().reverse();
    $("pbYears").innerHTML =
      '<button type="button" class="pb-chip pb-chip--yt' + (st.yt ? " on" : "") + '" data-yt="1" aria-pressed="' + st.yt + '">▶ 유튜브 있는 발표 <b>' + ytN + "</b></button>" +
      '<span class="pb-sep" aria-hidden="true"></span>' +
      '<button type="button" class="pb-chip' + (st.y === "all" ? " on" : "") + '" data-y="all">전 기간 <b>' + yAll + "</b></button>" +
      ys.map(function (y) {
        return '<button type="button" class="pb-chip' + (st.y === y ? " on" : "") + '" data-y="' + y + '">' + y + " <b>" + yc[y] + "</b></button>";
      }).join("");

    /* 걸려 있는 분석 거르기 */
    var act = [];
    if (st.f) {
      var F = FIELD[st.f];
      act.push('<button type="button" class="pb-act" data-clear="f">분야 · ' + esc(F ? F.name : st.f) +
        (st.kw !== "" && F && F.kw[+st.kw] ? " › " + esc(F.kw[+st.kw][0]) : "") + " <i>✕</i></button>");
    }
    if (st.org) act.push('<button type="button" class="pb-act" data-clear="org">기관 · ' + esc(st.org) + " <i>✕</i></button>");
    $("pbActive").innerHTML = act.join("");
    $("pbActive").hidden = !act.length;

    $("pbClr").classList.toggle("on", !!(st.q || st.g !== "all" || st.y !== "all" || st.r !== "all" || st.yt || st.f || st.org));
    var first = ITEMS.length ? ITEMS[ITEMS.length - 1].year : "", last = ITEMS.length ? ITEMS[0].year : "";
    $("pbCount").innerHTML = "모두 <strong>" + ITEMS.length + "</strong>건 · " + first + "–" + last +
      (pick.length !== ITEMS.length ? " · 지금 보이는 것 <strong>" + pick.length + "</strong>건" : "") +
      " · 유튜브 영상이 있는 발표 " + ITEMS.filter(function (it) { return it.vids.length; }).length + "건";

    if (!pick.length) {
      $("pbList").innerHTML = '<p class="pb-empty">맞는 발표가 없습니다. 낱말을 줄이거나 ✕ 검색 해제를 눌러 보세요.</p>';
      return;
    }
    var groups = {}, order = [];
    pick.forEach(function (it) {
      if (!groups[it.year]) { groups[it.year] = []; order.push(it.year); }
      groups[it.year].push(it);
    });
    $("pbList").innerHTML = order.map(function (y) {
      return '<div class="pub-subgroup"><h3 class="pub-subgroup__title">' + esc(y) + " <span>" + groups[y].length + "</span></h3>" +
        '<ol class="pub-list">' + groups[y].map(function (it) { return rowHtml(it, tms); }).join("") + "</ol></div>";
    }).join("");
  }

  function mountBoard() {
    $("pbApp").innerHTML =
      '<form class="gsearch" id="pbForm" role="search">' +
        '<div class="gsearch__box"><input type="search" id="pbQ" autocomplete="off" aria-label="발표 찾기" ' +
          'placeholder="제목·행사·기관·사람 이름·연도로 찾기 (예: 반환공여지, 국회, 평택, LH, 2025)"></div>' +
        '<button type="submit" class="gsearch__go">검색</button>' +
        '<button type="button" class="gsearch__clr" id="pbClr">✕ 검색 해제</button>' +
      "</form>" +
      '<nav class="gtabs pb-kinds" id="pbKinds" aria-label="행사 갈래"></nav>' +
      '<div class="pb-chips" id="pbRoles" aria-label="맡은 역할"></div>' +
      '<div class="pb-chips" id="pbYears" aria-label="연도"></div>' +
      '<div class="pb-active" id="pbActive" hidden></div>' +
      '<p class="talks-sum pb-count" id="pbCount"></p>' +
      '<div id="pbList"></div>';

    var q = $("pbQ");
    q.value = st.q;
    var timer;
    q.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { st.q = q.value; saveState(); drawBoard(); }, 160);
    });
    $("pbForm").addEventListener("submit", function (e) {
      e.preventDefault();
      clearTimeout(timer);
      st.q = q.value; saveState(); drawBoard();
    });
    $("pbClr").addEventListener("click", function () {
      st = { q: "", g: "all", y: "all", r: "all", yt: false, f: "", kw: "", org: "" };
      q.value = ""; saveState(); drawBoard(); markStats();
    });
    $("pbKinds").addEventListener("click", function (e) {
      var a = e.target.closest("[data-g]");
      if (!a) return;
      e.preventDefault();
      st.g = a.dataset.g; saveState(); drawBoard();
    });
    $("pbYears").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.yt) st.yt = !st.yt;
      else st.y = b.dataset.y;
      saveState(); drawBoard();
    });
    $("pbRoles").addEventListener("click", function (e) {
      var b = e.target.closest("[data-r]");
      if (!b) return;
      st.r = b.dataset.r; saveState(); drawBoard();
    });
    $("pbActive").addEventListener("click", function (e) {
      var b = e.target.closest("[data-clear]");
      if (!b) return;
      if (b.dataset.clear === "f") { st.f = ""; st.kw = ""; } else st.org = "";
      saveState(); drawBoard(); markStats();
    });
  }

  /* 분석에서 누르면 → 목록을 거르고 목록 머리로 */
  function applyFilter(o) {
    if ("f" in o) { st.f = o.f; st.kw = o.kw == null ? "" : String(o.kw); }
    if ("org" in o) st.org = o.org;
    if ("q" in o) { st.q = o.q; $("pbQ").value = o.q; }
    st.g = "all"; st.y = "all"; st.r = "all"; st.yt = false;
    saveState(); drawBoard(); markStats();
    var top = $("pbApp").getBoundingClientRect().top + window.pageYOffset - 90;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  /* ── 그리기: 주제별 통계 ──────────────────────────────────── */
  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  function seq(t) {   /* 한 빛깔(청록) 옅음 → 짙음 */
    var lo = [222, 238, 235], hi = [31, 84, 77];
    return "rgb(" + lerp(lo[0], hi[0], t) + "," + lerp(lo[1], hi[1], t) + "," + lerp(lo[2], hi[2], t) + ")";
  }
  function tipAttr(title, lines) {
    return ' data-tip-t="' + esc(title) + '" data-tip="' + esc((lines || []).join("\n")) + '" tabindex="0"';
  }

  function statsData() {
    var fc = {}, kwc = {}, fy = {}, years = {}, lens = {};
    ITEMS.forEach(function (it) {
      years[it.year] = 1;
      it.fields.forEach(function (f) {
        fc[f.id] = (fc[f.id] || []).concat(it);
        f.kws.forEach(function (i) { var k = f.id + ":" + i; kwc[k] = (kwc[k] || 0) + 1; });
        var c = f.id + "|" + it.year;
        fy[c] = (fy[c] || []).concat(it);
      });
      S.lensOf(it.t).forEach(function (l) { lens[l] = (lens[l] || 0) + 1; });
    });
    var yl = Object.keys(years).sort();
    var y0 = +yl[0], y1 = +yl[yl.length - 1], ys = [];
    for (var y = y0; y <= y1; y++) ys.push(String(y));
    var fields = S.FIELDS.filter(function (f) { return fc[f.id]; })
      .sort(function (a, b) { return fc[b.id].length - fc[a.id].length; });

    /* 기관 */
    var oc = {};
    ITEMS.forEach(function (it) {
      it.orgs.forEach(function (o) {
        var r = oc[o.name] || (oc[o.name] = { name: o.name, type: o.type, items: [] });
        r.items.push(it);
      });
    });
    var orgs = Object.keys(oc).map(function (k) { return oc[k]; })
      .sort(function (a, b) { return b.items.length - a.items.length || (b.items[0].t.sort - a.items[0].t.sort); });
    return { fc: fc, kwc: kwc, fy: fy, ys: ys, fields: fields, lens: lens, orgs: orgs };
  }

  function kpiHtml(D) {
    var thisYear = String(new Date().getFullYear());
    var nYear = ITEMS.filter(function (it) { return it.year === thisYear; }).length;
    var top = D.fields[0];
    var tile = function (v, l, s) {
      return '<div class="pb-kpi"><span class="pb-kpi__l">' + l + '</span><b class="pb-kpi__v">' + v + "</b>" +
        (s ? '<span class="pb-kpi__s">' + s + "</span>" : "") + "</div>";
    };
    return '<div class="pb-kpis">' +
      tile(ITEMS.length + "건", "대외 발표", D.ys[0] + "–" + D.ys[D.ys.length - 1]) +
      tile(nYear + "건", thisYear + "년", "예정 " + ITEMS.filter(function (it) { return it.soon; }).length + "건 포함") +
      tile(esc(top ? top.name : "—"), "가장 많이 다룬 분야", top ? D.fc[top.id].length + "건" : "") +
      tile(D.orgs.length + "곳", "함께한 기관", "소속 기관(경기연구원) 제외") +
    "</div>";
  }

  function barsHtml(D) {
    var max = D.fc[D.fields[0].id].length;
    return '<div class="pb-card"><h3 class="pb-card__h">분야별 발표 <small>한 발표가 여러 분야에 들 수 있습니다</small></h3>' +
      '<ol class="pb-bars">' + D.fields.map(function (f) {
        var n = D.fc[f.id].length;
        var kws = f.kw.map(function (k, i) { return { i: i, name: k[0], n: D.kwc[f.id + ":" + i] || 0 }; })
          .filter(function (k) { return k.n; }).sort(function (a, b) { return b.n - a.n; });
        return '<li class="pb-bar" data-f="' + f.id + '">' +
          '<button type="button" class="pb-bar__name" data-f="' + f.id + '"' +
            tipAttr(f.name + " · " + n + "건", D.fc[f.id].slice(0, 6).map(function (it) { return it.t.date + "  " + it.t.title; }).concat(n > 6 ? ["… 그리고 " + (n - 6) + "건 — 누르면 목록에서 봅니다"] : [])) + ">" +
            esc(f.name) + "</button>" +
          '<span class="pb-bar__track"><span class="pb-bar__fill" style="width:' + (n / max * 100).toFixed(1) + '%"></span>' +
            '<span class="pb-bar__n">' + n + "</span></span>" +
          '<span class="pb-bar__kw">' + kws.map(function (k) {
            return '<button type="button" data-f="' + f.id + '" data-kw="' + k.i + '">' + esc(k.name) + " <b>" + k.n + "</b></button>";
          }).join("") + "</span>" +
        "</li>";
      }).join("") + "</ol></div>";
  }

  function heatHtml(D) {
    var max = 1;
    Object.keys(D.fy).forEach(function (k) { max = Math.max(max, D.fy[k].length); });
    var colTot = {};
    var rows = D.fields.map(function (f) {
      var cells = D.ys.map(function (y) {
        var list = D.fy[f.id + "|" + y] || [];
        colTot[y] = colTot[y] || {};
        list.forEach(function (it) { colTot[y][it.k] = 1; });
        if (!list.length) return '<td class="pb-heat__0"></td>';
        var t = list.length / max, bg = seq(0.15 + 0.85 * t);
        return '<td><button type="button" class="pb-heat__c" data-f="' + f.id + '" data-y="' + y + '" style="background:' + bg + ";color:" + (t > 0.45 ? "#fff" : "#1c1a19") + '"' +
          tipAttr(f.name + " · " + y + "년 " + list.length + "건", list.map(function (it) { return it.t.date + "  " + it.t.title; })) + ">" + list.length + "</button></td>";
      }).join("");
      return '<tr><th scope="row">' + esc(f.name) + "</th>" + cells + '<td class="pb-heat__tot">' + D.fc[f.id].length + "</td></tr>";
    }).join("");
    var foot = '<tr class="pb-heat__foot"><th scope="row">발표 수</th>' + D.ys.map(function (y) {
      var n = ITEMS.filter(function (it) { return it.year === y; }).length;
      return "<td>" + (n || "") + "</td>";
    }).join("") + '<td class="pb-heat__tot">' + ITEMS.length + "</td></tr>";
    return '<div class="pb-card pb-card--wide"><h3 class="pb-card__h">분야의 흐름 <small>해마다 어느 분야를 많이 발표했나 — 짙을수록 많습니다. 칸을 누르면 그해 그 분야 발표만 봅니다</small></h3>' +
      '<div class="pb-heat-wrap"><table class="pb-heat"><thead><tr><th></th>' +
      D.ys.map(function (y) { return '<th scope="col">' + "’" + y.slice(2) + "</th>"; }).join("") +
      '<th scope="col" class="pb-heat__tot">계</th></tr></thead><tbody>' + rows + foot + "</tbody></table></div>" +
      '<p class="pb-legend-seq"><span>적음</span><i style="background:linear-gradient(90deg,' + seq(0.15) + "," + seq(1) + ')"></i><span>많음 (' + max + "건)</span></p></div>";
  }

  function keywordsHtml(D) {
    var kws = [];
    D.fields.forEach(function (f) {
      f.kw.forEach(function (k, i) {
        var n = D.kwc[f.id + ":" + i] || 0;
        if (n) kws.push({ f: f.id, i: i, name: k[0], n: n });
      });
    });
    Object.keys(D.lens).forEach(function (l) { kws.push({ lens: l, name: l, n: D.lens[l] }); });
    kws.sort(function (a, b) { return b.n - a.n; });
    var max = kws.length ? kws[0].n : 1;
    return '<div class="pb-card"><h3 class="pb-card__h">자주 쓴 키워드 <small>발표 제목에 나온 횟수 · 누르면 그 발표만</small></h3>' +
      '<p class="pb-cloud">' + kws.slice(0, 32).map(function (k) {
        var s = k.n / max, cls = s > 0.6 ? "l3" : s > 0.3 ? "l2" : "l1";
        return '<button type="button" class="pb-kw ' + cls + '"' + (k.lens ? ' data-q="일본"' : ' data-f="' + k.f + '" data-kw="' + k.i + '"') + ">" +
          esc(k.name) + " <b>" + k.n + "</b></button>";
      }).join("") + "</p>" +
      '<p class="pb-note">‘일본 사례’는 분야를 가로질러 따로 셌습니다 (일본의 빈집·학교복합화·산업유산·마을만들기 등).</p></div>';
  }

  /* 기관 연결망 — 가운데 남지현, 둘레에 기관(갈래별로 모아), 같은 발표에 함께 나온 기관끼리 선 */
  function netHtml(D) {
    var N = 40;
    var top = D.orgs.slice(0, N);
    var groups = S.TYPES.map(function (t) {
      return { t: t, list: top.filter(function (o) { return o.type === t.id; }) };
    }).filter(function (g) { return g.list.length; });
    var W = 860, H = 860, cx = W / 2, cy = H / 2, R = 250;
    var gap = 0.16, slots = top.length, totalGap = gap * groups.length;
    var step = (Math.PI * 2 - totalGap) / slots;
    var a = -Math.PI / 2 + gap / 2, pos = {};
    var maxN = top.length ? top[0].items.length : 1;
    var arcs = [];
    groups.forEach(function (g) {
      var a0 = a;
      g.list.sort(function (x, y) { return y.items.length - x.items.length; }).forEach(function (o) {
        var ang = a + step / 2;
        pos[o.name] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang), ang: ang, o: o };
        a += step;
      });
      arcs.push({ g: g, a0: a0, a1: a });
      a += gap;
    });
    /* 같이 나온 횟수 */
    var pair = {};
    ITEMS.forEach(function (it) {
      var ns = it.orgs.map(function (o) { return o.name; }).filter(function (n) { return pos[n]; });
      for (var i = 0; i < ns.length; i++) for (var j = i + 1; j < ns.length; j++) {
        var k = ns[i] < ns[j] ? ns[i] + "\u0001" + ns[j] : ns[j] + "\u0001" + ns[i];
        pair[k] = (pair[k] || 0) + 1;
      }
    });
    var pairs = Object.keys(pair).map(function (k) { var p = k.split("\u0001"); return { a: p[0], b: p[1], n: pair[k] }; })
      .sort(function (x, y) { return y.n - x.n; });
    var r = function (n) { return 4 + 9 * Math.sqrt(n / maxN); };

    var svg = '<svg class="pb-net" viewBox="0 0 ' + W + " " + H + '" role="img" aria-labelledby="pbNetT">' +
      '<title id="pbNetT">함께한 기관 연결망 — 가운데가 남지현, 둘레의 점이 기관(크기 = 함께한 발표 수), 기관끼리의 선 = 같은 발표에 함께 나온 횟수</title>';
    /* 갈래 호 */
    arcs.forEach(function (ar) {
      var R2 = R - 22, x0 = cx + R2 * Math.cos(ar.a0), y0 = cy + R2 * Math.sin(ar.a0),
          x1 = cx + R2 * Math.cos(ar.a1), y1 = cy + R2 * Math.sin(ar.a1), big = ar.a1 - ar.a0 > Math.PI ? 1 : 0;
      svg += '<path d="M' + x0.toFixed(1) + " " + y0.toFixed(1) + " A" + R2 + " " + R2 + " 0 " + big + " 1 " + x1.toFixed(1) + " " + y1.toFixed(1) +
        '" fill="none" stroke="' + TYPE_COLOR[ar.g.t.id] + '" stroke-width="3" stroke-linecap="round" opacity=".55"/>';
    });
    /* 기관끼리 */
    svg += '<g class="pb-net__pairs">';
    pairs.filter(function (p) { return p.n >= 2; }).forEach(function (p) {
      var A = pos[p.a], B = pos[p.b];
      var mx = cx + ((A.x + B.x) / 2 - cx) * 0.25, my = cy + ((A.y + B.y) / 2 - cy) * 0.25;
      svg += '<path class="pb-net__pair" data-a="' + esc(p.a) + '" data-b="' + esc(p.b) + '" d="M' + A.x.toFixed(1) + " " + A.y.toFixed(1) +
        " Q" + mx.toFixed(1) + " " + my.toFixed(1) + " " + B.x.toFixed(1) + " " + B.y.toFixed(1) +
        '" stroke-width="' + Math.min(5, 0.6 + p.n * 0.7).toFixed(1) + '"/>';
    });
    svg += "</g>";
    /* 가운데에서 기관으로 */
    svg += '<g class="pb-net__spokes">';
    top.forEach(function (o) {
      var P = pos[o.name];
      svg += '<line class="pb-net__spoke" data-o="' + esc(o.name) + '" x1="' + cx + '" y1="' + cy + '" x2="' + P.x.toFixed(1) + '" y2="' + P.y.toFixed(1) +
        '" stroke="' + TYPE_COLOR[o.type] + '" stroke-width="' + (0.8 + 3.2 * o.items.length / maxN).toFixed(1) + '"/>';
    });
    svg += "</g>";
    /* 기관 점 + 이름 */
    top.forEach(function (o) {
      var P = pos[o.name], deg = P.ang * 180 / Math.PI, left = Math.cos(P.ang) < 0;
      var lx = cx + (R + r(o.items.length) + 6) * Math.cos(P.ang), ly = cy + (R + r(o.items.length) + 6) * Math.sin(P.ang);
      var rot = left ? deg + 180 : deg;
      var lines = o.items.slice(0, 5).map(function (it) { return it.t.date + "  " + it.t.title; });
      if (o.items.length > 5) lines.push("… 그리고 " + (o.items.length - 5) + "건 — 누르면 목록에서 봅니다");
      svg += '<g class="pb-net__node" data-o="' + esc(o.name) + '" role="button"' +
        tipAttr(o.name + " · " + TYPE[o.type].name + " · 함께한 발표 " + o.items.length + "건", lines) + ">" +
        '<circle cx="' + P.x.toFixed(1) + '" cy="' + P.y.toFixed(1) + '" r="' + (r(o.items.length) + 8).toFixed(1) + '" fill="transparent"/>' +
        '<circle class="pb-net__dot" cx="' + P.x.toFixed(1) + '" cy="' + P.y.toFixed(1) + '" r="' + r(o.items.length).toFixed(1) + '" fill="' + TYPE_COLOR[o.type] + '"/>' +
        '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" transform="rotate(' + rot.toFixed(1) + " " + lx.toFixed(1) + " " + ly.toFixed(1) + ')"' +
          ' text-anchor="' + (left ? "end" : "start") + '" dominant-baseline="middle">' + esc(o.name.length > 13 ? o.name.slice(0, 12) + "…" : o.name) + " " + o.items.length + "</text></g>";
    });
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="34" class="pb-net__me"/>' +
      '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" class="pb-net__me-t">남지현</text>' +
      '<text x="' + cx + '" y="' + (cy + 13) + '" text-anchor="middle" class="pb-net__me-s">경기연구원</text></svg>';

    /* 갈래별 집계 (범례) */
    var tc = {};
    D.orgs.forEach(function (o) {
      var c = tc[o.type] || (tc[o.type] = { orgs: 0, talks: {} });
      c.orgs++;
      o.items.forEach(function (it) { c.talks[it.k] = 1; });
    });
    var legend = '<ul class="pb-legend">' + S.TYPES.map(function (t) {
      var c = tc[t.id];
      return c ? '<li><i style="background:' + TYPE_COLOR[t.id] + '"></i><b>' + esc(t.name) + "</b> " + c.orgs + "곳 · 발표 " + Object.keys(c.talks).length + "건</li>" : "";
    }).join("") + "</ul>";

    /* 표 보기 — 상위 기관 */
    var table = '<table class="pb-otable"><caption>함께한 기관 순위 (상위 20)</caption><thead><tr><th scope="col">#</th><th scope="col">기관</th><th scope="col">갈래</th><th scope="col">발표</th><th scope="col">기간</th></tr></thead><tbody>' +
      D.orgs.slice(0, 20).map(function (o, i) {
        var ys = o.items.map(function (it) { return it.year; }).sort();
        return '<tr><td>' + (i + 1) + '</td><td><button type="button" class="pb-olink" data-o="' + esc(o.name) + '">' + esc(o.name) + "</button></td>" +
          '<td><i class="pb-sw" style="background:' + TYPE_COLOR[o.type] + '"></i><span class="pb-tname">' + esc(TYPE[o.type].name) + "</span></td>" +
          "<td>" + o.items.length + "</td><td>" + (ys[0] === ys[ys.length - 1] ? ys[0] : ys[0] + "–" + ys[ys.length - 1].slice(2)) + "</td></tr>";
      }).join("") + "</tbody></table>";

    var pairList = '<div class="pb-pairs"><h4>같은 자리에 자주 함께 나온 기관</h4><ol>' + pairs.slice(0, 8).map(function (p) {
      return '<li><button type="button" class="pb-olink" data-o="' + esc(p.a) + '">' + esc(p.a) + '</button> + <button type="button" class="pb-olink" data-o="' + esc(p.b) + '">' + esc(p.b) + "</button> <b>" + p.n + "회</b></li>";
    }).join("") + "</ol></div>";

    return '<div class="pb-card pb-card--wide pb-netcard"><h3 class="pb-card__h">함께한 기관 연결망 <small>텍스트마이닝 — 상위 ' + top.length + "곳 (전체 " + D.orgs.length + "곳)</small></h3>" +
      '<p class="pb-note">행사 개요의 주최·주관·후원·행사명과 함께한 분의 소속 글에서 기관 이름을 뽑았습니다 — 같은 기관의 여러 표기(예: LHI·LHRI → LH 토지주택연구원)는 하나로 모으고, 발표 한 건에 여러 번 나와도 한 번으로 셉니다. ' +
      "점이 클수록 자주 함께했고, 둘레 기관끼리 이은 선은 같은 행사에 2번 이상 함께 나온 사이입니다. 점에 올리면 발표가, 누르면 목록이 걸러집니다.</p>" +
      legend +
      '<div class="pb-net-grid"><div class="pb-net-wrap">' + svg + "</div><div>" + table + pairList + "</div></div></div>";
  }

  var STATS_READY = false;
  function drawStats() {
    var D = statsData();
    if (!D.fields.length) { $("pbStats").innerHTML = ""; return; }
    $("pbStats").innerHTML = kpiHtml(D) +
      '<div class="pb-grid2">' + barsHtml(D) + keywordsHtml(D) + "</div>" +
      heatHtml(D) + netHtml(D);
    STATS_READY = true;
    markStats();

    $("pbStats").addEventListener("click", function (e) {
      var b = e.target.closest("[data-f],[data-o],[data-q]");
      if (!b) return;
      if (b.dataset.o) return applyFilter({ org: b.dataset.o, f: "" });
      if (b.dataset.q) return applyFilter({ q: b.dataset.q, f: "", org: "" });
      if (b.dataset.y) {   /* 칸 = 분야 + 연도 */
        applyFilter({ f: b.dataset.f, org: "" });
        st.y = b.dataset.y; saveState(); drawBoard();
        return;
      }
      applyFilter({ f: b.dataset.f, kw: b.dataset.kw == null ? null : b.dataset.kw, org: "" });
    });
    $("pbStats").addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".pb-net__node")) {
        e.preventDefault();
        applyFilter({ org: e.target.dataset.o, f: "" });
      }
    });
    /* 연결망: 기관에 올리면 그 기관의 선만 짙게 */
    var net = $("pbStats").querySelector(".pb-net");
    if (net) {
      var on = function (name) {
        net.classList.toggle("is-focus", !!name);
        [].forEach.call(net.querySelectorAll(".pb-net__pair"), function (p) {
          p.classList.toggle("on", !!name && (p.dataset.a === name || p.dataset.b === name));
        });
        [].forEach.call(net.querySelectorAll(".pb-net__spoke"), function (p) { p.classList.toggle("on", p.dataset.o === name); });
        [].forEach.call(net.querySelectorAll(".pb-net__node"), function (p) { p.classList.toggle("on", p.dataset.o === name); });
      };
      net.addEventListener("mouseover", function (e) { var g = e.target.closest(".pb-net__node"); on(g ? g.dataset.o : ""); });
      net.addEventListener("mouseleave", function () { on(""); });
      net.addEventListener("focusin", function (e) { var g = e.target.closest(".pb-net__node"); on(g ? g.dataset.o : ""); });
      net.addEventListener("focusout", function () { on(""); });
    }
  }
  /* 지금 걸린 분야·기관을 통계에서도 표시 */
  function markStats() {
    if (!STATS_READY) return;
    [].forEach.call($("pbStats").querySelectorAll(".pb-bar"), function (li) { li.classList.toggle("on", li.dataset.f === st.f); });
    [].forEach.call($("pbStats").querySelectorAll(".pb-olink"), function (b) { b.classList.toggle("on", b.dataset.o === st.org); });
  }

  /* ── 연구주제별 자문단 (주인에게만) ──────────────────────────
     · 공개 행사: talk-info.json 의 「함께한 분」 중 발제·토론·좌장·사회·기조
       (인사말·축사 같은 의례 순서와 정치인은 빼고)
     · 회의·자문: 로그인한 주인의 일정(notes, schedule)에 적힌 「만난 사람」
     · 경기연구원 분(동료)과 남지현 본인은 뺍니다. 같은 날 같은 분은 한 번으로 셉니다.
     분야는 위 「분야별 발표」와 같은 규칙(talk-stats.js)으로 행사 이름에서 붙입니다. */
  var OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
  function ownerHint() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!/skyish-auth|^sb-.*-auth-token$/.test(k)) continue;
        var v = JSON.parse(localStorage.getItem(k) || "null");
        var u = v && (v.user || (v.currentSession && v.currentSession.user));
        if (u && u.email && OWNERS.indexOf(String(u.email).toLowerCase()) >= 0) return true;
      }
    } catch (e) {}
    return false;
  }
  var CEREMONY = /^(인사말|개회사|환영사|축사|폐회사|기념사|격려사)$/;
  var POLITICIAN = /국회의원|도의원|시의원|^의원$|도지사|^지사$|시장$|군수|구청장|장관|차관/;
  var SELF_ORG = /경기연구원|\bGRI\b/;
  var COUNCIL = /(시|도|군|구)의회|(민주당|국민의힘|정의당|진보당|국회의원실?)$/;   /* 의원·정당 (의회 사무처·전문위원실 직원은 남김) */
  var STAFF = /전문위원실|사무처|정책지원|입법조사/;
  var ROLE_RANK = ["좌장", "기조강연", "기조연설", "기조발제", "주제발표", "발제", "발표", "토론", "패널", "사회", "자문·회의", "참석"];

  function splitPeople(str) {
    var out = [], depth = 0, cur = "";
    String(str || "").split("").forEach(function (ch) {
      if (ch === "(" || ch === "（") depth++;
      if (ch === ")" || ch === "）") depth = Math.max(0, depth - 1);
      if ((ch === "," || ch === "，") && !depth) { out.push(cur); cur = ""; } else cur += ch;
    });
    out.push(cur);
    return out.map(function (x) {
      var m = /^\s*([^\s(（]+)\s*(?:[(（](.*)[)）])?\s*$/.exec(x);
      return m ? { name: m[1], org: (m[2] || "").trim() } : null;
    }).filter(function (p) { return p && /^([가-힣]{2,4}|[A-Za-z][A-Za-z .'-]{1,30})$/.test(p.name); });
  }

  /* 같은 분을 한 줄로 — 「성균관대 ○○센터」·「성균관대학교」 처럼 적은 소속을 같은 열쇠로 */
  function orgKey(org) {
    var o = S.orgName(org).replace(/^[(（]\s*(주|사)\s*[)）]\s*|^㈜\s*/, "");
    var m = /^([가-힣A-Za-z]+?)(대학교|대)(?=[\s(·,]|$)/.exec(o);
    o = m ? m[1] + "대학교" : o.split(/[\s(·,]/)[0];
    return o.replace(/^(국립|한국)/, "");
  }

  function buildAdvisors(notes) {
    var P = {}, byName = {}, EXCL = {};
    function key(name, org) { return name + "|" + (org ? orgKey(org) : ""); }
    function add(name, title, org, enc) {
      if (!name || name === "남지현" || EXCL[name] || SELF_ORG.test(org || "")) return;
      if ((title && POLITICIAN.test(title)) || (COUNCIL.test(org || "") && !STAFF.test(org || ""))) { EXCL[name] = 1; return; }
      var k = key(name, org);
      var r = P[k] || (P[k] = { name: name, title: "", orgs: {}, enc: {} });
      if (title && !r.title) r.title = title;
      if (org) r.orgs[org] = (r.orgs[org] || 0) + 1;
      var ek = enc.date || enc.label;
      var old = r.enc[ek];
      if (!old || (old.src === "note" && enc.src === "talk")) r.enc[ek] = enc;   /* 같은 날은 한 번 — 공개 행사 쪽을 남김 */
      (byName[name] = byName[name] || {})[k] = 1;
    }
    ITEMS.forEach(function (it) {
      var d = it.k.slice(0, 4) + "-" + it.k.slice(4, 6) + "-" + it.k.slice(6, 8);
      (it.I.people || []).forEach(function (p) {
        if (!p || !p.name) return;
        if (CEREMONY.test(p.role || "") || POLITICIAN.test(p.title || "")) { EXCL[p.name] = 1; return; }
        add(p.name, p.title, p.org, { date: d, label: it.t.title, host: it.t.host, k: it.k, fields: it.fields.map(function (f) { return f.id; }), role: p.role || "참석", src: "talk" });
      });
    });
    /* 일정 글 — 행사 이름(event)이 적힌 회의·자문만 (사적인 모임·메모는 건너뜀) */
    (notes || []).forEach(function (n) {
      if (!n.event || /^\s*</.test(n.event)) return;
      var label = n.event;
      var fs = S.fieldsOf({ title: [n.event, n.title].filter(Boolean).join(" ") }, null).map(function (f) { return f.id; });
      splitPeople(n.people).forEach(function (p) {
        add(p.name, "", p.org, { date: n.event_date || "", label: label, fields: fs, role: "자문·회의", src: "note" });
      });
    });
    /* 소속을 안 적은 기록은 같은 이름이 한 분뿐이면 그분께 붙입니다 */
    Object.keys(P).forEach(function (k) {
      if (!/\|$/.test(k)) return;
      var name = k.slice(0, -1), others = Object.keys(byName[name] || {}).filter(function (x) { return x !== k && P[x]; });
      if (others.length !== 1) return;
      var to = P[others[0]], from = P[k];
      Object.keys(from.enc).forEach(function (e) { if (!to.enc[e]) to.enc[e] = from.enc[e]; });
      if (!to.title) to.title = from.title;
      delete P[k];
    });
    /* 같은 이름인데 소속이 달리 적힌 기록 — 같은 연구 분야에서 만났으면 한 분으로 봅니다
       (예: LHRI·LH 토지주택연구원, 前·現 소속). 분야가 겹치지 않으면 동명이인으로 남깁니다. */
    var fieldsOfRec = function (r) {
      var f = {};
      Object.keys(r.enc).forEach(function (e) { r.enc[e].fields.forEach(function (x) { f[x] = 1; }); });
      return f;
    };
    Object.keys(byName).forEach(function (name) {
      var ks = Object.keys(byName[name]).filter(function (k) { return P[k]; });
      for (var i = 0; i < ks.length; i++) {
        for (var j = i + 1; j < ks.length; j++) {
          var A = P[ks[i]], B = P[ks[j]];
          if (!A || !B) continue;
          var fa = fieldsOfRec(A), fb = fieldsOfRec(B);
          if (!Object.keys(fa).some(function (x) { return fb[x]; })) continue;
          Object.keys(B.enc).forEach(function (e) { if (!A.enc[e]) A.enc[e] = B.enc[e]; });
          Object.keys(B.orgs).forEach(function (o) { A.orgs[o] = (A.orgs[o] || 0) + B.orgs[o]; });
          if (!A.title) A.title = B.title;
          delete P[ks[j]];
        }
      }
    });
    return Object.keys(P).map(function (k) {
      var r = P[k];
      r.list = Object.keys(r.enc).map(function (e) { return r.enc[e]; }).sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      r.orgList = Object.keys(r.orgs).sort(function (a, b) { return r.orgs[b] - r.orgs[a]; });
      r.org = r.orgList[0] || "";
      r.roles = {};
      r.list.forEach(function (e) { r.roles[e.role] = (r.roles[e.role] || 0) + 1; });
      r.fields = {};
      r.list.forEach(function (e) { e.fields.forEach(function (f) { r.fields[f] = (r.fields[f] || 0) + 1; }); });
      return r;
    });
  }

  var ADV = { all: [], f: "all", q: "", more: false, sort: "n", dir: -1, order: [] };
  /* 그 분이 가장 많이 만난 분야 (같으면 분야 칩 차례) */
  function mainField(r) {
    var best = "", bn = 0;
    ADV.order.forEach(function (id) { if ((r.fields[id] || 0) > bn) { bn = r.fields[id]; best = id; } });
    return best;
  }
  function relList(r) {
    return ADV.f === "all" ? r.list : r.list.filter(function (e) { return e.fields.indexOf(ADV.f) >= 0; });
  }
  function topRole(r) {
    var best = 99;
    Object.keys(r.roles).forEach(function (k) { var i = ROLE_RANK.indexOf(k); best = Math.min(best, i < 0 ? 98 : i); });
    return best;
  }
  var SORTS = {
    name:   { dir: 1,  fn: function (a, b) { return a.name.localeCompare(b.name, "ko"); } },
    org:    { dir: 1,  fn: function (a, b) { return (a.org || "\uffff").localeCompare(b.org || "\uffff", "ko"); } },
    field:  { dir: 1,  fn: function (a, b) {
      var fa = mainField(a), fb = mainField(b);
      var ia = fa ? ADV.order.indexOf(fa) : 99, ib = fb ? ADV.order.indexOf(fb) : 99;
      return ia - ib || (b.fields[fb] || 0) - (a.fields[fa] || 0) || 0;
    } },
    n:      { dir: -1, fn: function (a, b) { return relList(a).length - relList(b).length; } },
    role:   { dir: 1,  fn: function (a, b) { return topRole(a) - topRole(b); } },
    recent: { dir: -1, fn: function (a, b) {
      var la = relList(a)[0], lb = relList(b)[0];
      return ((la && la.date) || "").localeCompare((lb && lb.date) || "");
    } }
  };
  function advRows() {
    var f = ADV.f, q = norm(ADV.q).trim();
    var S0 = SORTS[ADV.sort] || SORTS.n, dir = ADV.dir;
    return ADV.all.filter(function (r) { return f === "all" || r.fields[f]; })
      .filter(function (r) {
        if (!q) return true;
        var fn = Object.keys(r.fields).map(function (id) { return FIELD[id] ? FIELD[id].short + " " + FIELD[id].name : ""; }).join(" ");
        return norm([r.name, r.title, r.org, fn].join(" ")).indexOf(q) >= 0 || tight([r.name, r.org].join("")).indexOf(tight(q)) >= 0;
      })
      .sort(function (a, b) {
        return dir * S0.fn(a, b) ||
          relList(b).length - relList(a).length || b.list.length - a.list.length ||
          (b.list[0].date || "").localeCompare(a.list[0].date || "");
      });
  }
  function rolesText(r) {
    return Object.keys(r.roles).sort(function (a, b) {
      var ia = ROLE_RANK.indexOf(a), ib = ROLE_RANK.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }).map(function (k) { return k + (r.roles[k] > 1 ? " " + r.roles[k] : ""); }).join(" · ");
  }
  function encText(e) {
    return (e.date || "").replace(/-/g, ".") + " " + e.label;
  }
  function drawAdv() {
    var fc = { all: ADV.all.length };
    ADV.all.forEach(function (r) { Object.keys(r.fields).forEach(function (f) { fc[f] = (fc[f] || 0) + 1; }); });
    var fields = S.FIELDS.filter(function (f) { return fc[f.id]; }).sort(function (a, b) { return fc[b.id] - fc[a.id]; });
    ADV.order = fields.map(function (x) { return x.id; });
    [].forEach.call(document.querySelectorAll(".adv-table th[data-sort]"), function (th) {
      var on = th.dataset.sort === ADV.sort;
      th.setAttribute("aria-sort", on ? (ADV.dir > 0 ? "ascending" : "descending") : "none");
      th.querySelector("i").textContent = on ? (ADV.dir > 0 ? "▲" : "▼") : "↕";
    });
    $("advChips").innerHTML = [["all", "전체"]].concat(fields.map(function (f) { return [f.id, f.name]; })).map(function (x) {
      return '<button type="button" class="pb-chip' + (ADV.f === x[0] ? " on" : "") + '" data-af="' + x[0] + '">' + esc(x[1]) + " <b>" + (fc[x[0]] || 0) + "</b></button>";
    }).join("");
    var rows = advRows(), shown = ADV.more ? rows : rows.slice(0, 40);
    var f = ADV.f;
    var SORT_NAME = { name: "이름", org: "소속", field: "분야", n: "횟수", role: "역할", recent: "최근 만난 날" };
    $("advCount").textContent = (f === "all" ? "전체" : FIELD[f].name) + " · " + rows.length + "명 · " +
      SORT_NAME[ADV.sort] + (ADV.dir > 0 ? " 오름차순" : " 내림차순");
    $("advBody").innerHTML = rows.length ? shown.map(function (r, i) {
      var fl = relList(r);
      var fchips = ADV.order.filter(function (id) { return r.fields[id]; })
        .sort(function (x, y) { return r.fields[y] - r.fields[x] || ADV.order.indexOf(x) - ADV.order.indexOf(y); })
        .map(function (id) {
          return '<button type="button" class="adv-f adv-f--' + id + (id === f ? " on" : "") + '" data-af="' + id + '" title="' + esc(FIELD[id].name) + ' 분야만 보기">' +
            esc(FIELD[id].short) + (r.fields[id] > 1 ? " " + r.fields[id] : "") + "</button>";
        }).join("");
      var href = "contact.html?p=addr&who=" + encodeURIComponent(r.name) + (r.org ? "&org=" + encodeURIComponent(r.org) : "");
      var where = fl.slice(0, 3).map(function (e) {
        var t = esc(encText(e));
        return e.k ? '<a href="talk.html?k=' + e.k + '">' + t + "</a>" : "<span>" + t + "</span>";
      }).join("") + (fl.length > 3 ? "<small>외 " + (fl.length - 3) + "건</small>" : "");
      return "<tr><td>" + (i + 1) + "</td>" +
        '<td><a class="adv-name" href="' + href + '" title="' + esc(r.name) + ' 명함 보기">' + esc(r.name) + "</a></td>" +
        "<td>" + esc([r.title, r.org].filter(Boolean).join(" · ")) +
          (r.orgList.length > 1 ? '<small class="adv-also">다른 소속: ' + esc(r.orgList.slice(1, 3).join(", ")) + "</small>" : "") + "</td>" +
        '<td class="adv-fs">' + (fchips || '<span class="adv-none">—</span>') + "</td>" +
        '<td class="adv-n"><b>' + fl.length + "</b>" + (f !== "all" && r.list.length > fl.length ? "<small>/" + r.list.length + "</small>" : "") + "</td>" +
        "<td>" + esc(rolesText(r)) + "</td>" +
        '<td class="adv-where">' + where + "</td></tr>";
    }).join("") : '<tr><td colspan="7" class="pb-empty">맞는 분이 없습니다.</td></tr>';
    $("advMore").hidden = rows.length <= 40;
    $("advMore").textContent = ADV.more ? "앞의 40명만 보기" : "모두 보기 (" + rows.length + "명)";
  }
  function advCsv() {
    var f = ADV.f, rows = advRows();
    var q = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [["보기", "이름", "직함", "소속", "주 분야", "분야(횟수)", "이 분야 횟수", "전체 횟수", "역할", "최근", "함께한 자리"].join(",")];
    rows.forEach(function (r) {
      var fl = f === "all" ? r.list : r.list.filter(function (e) { return e.fields.indexOf(f) >= 0; });
      var mf = mainField(r);
      var fs = ADV.order.filter(function (id) { return r.fields[id]; }).map(function (id) { return FIELD[id].name + " " + r.fields[id]; }).join(" / ");
      lines.push([f === "all" ? "전체" : FIELD[f].name, r.name, r.title, r.org, mf ? FIELD[mf].name : "", fs, fl.length, r.list.length, rolesText(r),
        (r.list[0].date || ""), fl.map(encText).join(" / ")].map(q).join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "자문단_" + (f === "all" ? "전체" : FIELD[f].name.replace(/[·\/]/g, "_")) + ".csv";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function drawAdvisors() {
    var mount = $("pbAdv");
    if (!mount || !ownerHint()) return;
    import(new URL("auth/auth.js", location.href).href).then(function (A) {
      return Promise.resolve(A.currentUser && A.currentUser()).then(function (u) {
        if (!u || OWNERS.indexOf(String(u.email || "").toLowerCase()) < 0) return null;
        var all = [];
        var page = function (from) {
          return A.sb.from("notes").select("id,title,tag,event_date,people,event").eq("category", "schedule")
            .not("people", "is", null).neq("people", "").order("event_date", { ascending: false }).range(from, from + 999)
            .then(function (r) {
              if (r.error) throw r.error;
              all = all.concat(r.data || []);
              return (r.data || []).length === 1000 ? page(from + 1000) : all;
            });
        };
        return page(0).catch(function () { return []; });
      });
    }).then(function (notes) {
      if (notes === null) return;
      ADV.all = buildAdvisors(notes);
      if (!ADV.all.length) return;
      var nTalk = ADV.all.filter(function (r) { return r.list.some(function (e) { return e.src === "talk"; }); }).length;
      mount.innerHTML = '<div class="pb-card pb-card--wide adv" id="advisors">' +
        '<h3 class="pb-card__h">연구주제별 자문단 <span class="adv-lock">🔒 주인에게만 보입니다</span>' +
        "<small>공개 행사에서 함께 발제·토론·좌장을 맡은 분(" + nTalk + "명)과 일정에 적어 둔 자문회의·회의에서 만난 분을 분야별로 모았습니다 — 모두 " + ADV.all.length +
        "명. 경기연구원 동료와 의례 순서(인사말·축사)·정치인은 뺐습니다. 이름을 누르면 주소록 명함이 열립니다.</small></h3>" +
        '<div class="pb-chips" id="advChips"></div>' +
        '<div class="adv-tools"><input type="search" id="advQ" placeholder="이름·기관으로 찾기" aria-label="자문단 찾기">' +
          '<span class="adv-count" id="advCount"></span><button type="button" class="pb-chip" id="advCsv">CSV 내려받기</button></div>' +
        '<div class="adv-wrap"><table class="adv-table"><thead><tr><th>#</th>' +
          [["name", "이름"], ["org", "직함 · 소속"], ["field", "분야"], ["n", "횟수"], ["role", "역할"], ["recent", "함께한 자리"]].map(function (c) {
            return '<th data-sort="' + c[0] + '" aria-sort="none"><button type="button" class="adv-sort">' + c[1] + ' <i aria-hidden="true">↕</i></button></th>';
          }).join("") + "</tr></thead>" +
        '<tbody id="advBody"></tbody></table></div>' +
        '<p class="adv-more-row"><button type="button" class="pb-chip" id="advMore"></button></p></div>';
      drawAdv();
      $("advChips").addEventListener("click", function (e) {
        var b = e.target.closest("[data-af]");
        if (!b) return;
        ADV.f = b.dataset.af; ADV.more = false; drawAdv();
      });
      var t;
      $("advQ").addEventListener("input", function (e) {
        clearTimeout(t);
        t = setTimeout(function () { ADV.q = e.target.value; drawAdv(); }, 150);
      });
      $("advMore").addEventListener("click", function () { ADV.more = !ADV.more; drawAdv(); });
      mount.querySelector(".adv-table thead").addEventListener("click", function (e) {
        var th = e.target.closest("th[data-sort]");
        if (!th) return;
        var k = th.dataset.sort;
        if (ADV.sort === k) ADV.dir = -ADV.dir;
        else { ADV.sort = k; ADV.dir = SORTS[k].dir; }
        drawAdv();
      });
      $("advBody").addEventListener("click", function (e) {
        var b = e.target.closest("[data-af]");
        if (!b) return;
        ADV.f = ADV.f === b.dataset.af ? "all" : b.dataset.af; ADV.more = false; drawAdv();
      });
      $("advCsv").addEventListener("click", advCsv);
      if (location.hash === "#advisors") mount.scrollIntoView();
    }).catch(function () {});
  }

  /* ── 풍선 도움말 (막대·칸·기관) ───────────────────────────── */
  function tooltip() {
    var tip = $("pbTip");
    var show = function (el, x, y) {
      var t = el.getAttribute("data-tip-t") || "", body = el.getAttribute("data-tip") || "";
      tip.innerHTML = "<b>" + esc(t) + "</b>" + (body ? "<span>" + body.split("\n").map(esc).join("<br>") + "</span>" : "");
      tip.hidden = false;
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var left = Math.min(window.innerWidth - w - 12, Math.max(12, x + 14));
      var top = y + 18 + h > window.innerHeight ? y - h - 14 : y + 18;
      tip.style.left = left + "px";
      tip.style.top = Math.max(8, top) + "px";
    };
    var hide = function () { tip.hidden = true; };
    document.addEventListener("mousemove", function (e) {
      var el = e.target.closest && e.target.closest("[data-tip-t]");
      if (el) show(el, e.clientX, e.clientY); else hide();
    });
    document.addEventListener("focusin", function (e) {
      var el = e.target.closest && e.target.closest("[data-tip-t]");
      if (!el) return hide();
      var r = el.getBoundingClientRect();
      show(el, r.left, r.bottom - 10);
    });
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, { passive: true });
  }

  function start() {
    if (!S) { $("pbApp").innerHTML = '<p class="pb-empty">분석 도구를 읽지 못했습니다.</p>'; return; }
    var talks = window.TALKS || [];
    fetch("assets/data/talk-info.json?v=" + Math.floor(Date.now() / 36e5), { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (info) {
        build(talks, info || {});
        mountBoard();
        drawBoard();
        drawStats();
        drawAdvisors();
        tooltip();
        if (location.hash === "#analysis") {
          var el = $("analysis");
          if (el) setTimeout(function () { el.scrollIntoView(); }, 60);
        }
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
