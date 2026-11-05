/* ------------------------------------------------------------------
   Presentations 게시판 — presentations.html

   ● 위: 발표 목록
       낱말 찾기(제목·행사·장소·주최·함께한 분·프로그램·기관), 갈래 단추, 연도, ▶ 유튜브만
       · 제목 → talk.html?k=<sort> (행사 개요)
       · ▶ 유튜브 → 그 영상(YouTube)으로 바로
       · 주소에 상태가 남습니다: presentations.html?q=국회&y=2025&yt=1&f=usfk&org=국토연구원
   ● 아래: 주제별 통계 (전체 발표 기준)
       분야별 발표 수 · 분야의 흐름(연도) · 자주 쓴 키워드 · 기관 연결망(텍스트마이닝)
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
        kind: S.kindOf(t.tag), vids: vids, soon: t.sort > today,
        fields: S.fieldsOf(t, I), orgs: S.orgsOf(t, I)
      };
      /* 찾기용 — [이름표, 글] */
      it.parts = [
        ["제목", t.title], ["행사", [t.host, I.event].filter(Boolean).join(" · ")], ["갈래", t.tag],
        ["날짜", t.date + " " + t.sort], ["장소", I.where], ["주최·주관", [I.host, I.org, I.support].filter(Boolean).join(" · ")],
        ["개요", I.about]
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
  var st = { q: "", g: "all", y: "all", yt: false, f: "", kw: "", org: "" };
  (function () {
    var sp = new URLSearchParams(location.search);
    st.q = sp.get("q") || "";
    st.g = sp.get("g") || "all";
    st.y = sp.get("y") || "all";
    st.yt = sp.get("yt") === "1";
    st.f = sp.get("f") || "";
    st.kw = sp.get("kw") || "";
    st.org = sp.get("org") || "";
  })();
  function saveState() {
    var sp = new URLSearchParams();
    if (st.q) sp.set("q", st.q);
    if (st.g !== "all") sp.set("g", st.g);
    if (st.y !== "all") sp.set("y", st.y);
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
      (t.tag ? '<span class="pub__role">' + esc(t.tag) + "</span>" : "") +
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

    $("pbClr").classList.toggle("on", !!(st.q || st.g !== "all" || st.y !== "all" || st.yt || st.f || st.org));
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
      st = { q: "", g: "all", y: "all", yt: false, f: "", kw: "", org: "" };
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
    st.g = "all"; st.y = "all"; st.yt = false;
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
