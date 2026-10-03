/* =============================================================
   [경기도 노후 산업단지] 움직이는 차트 — aging-complex.html
   논문 v7 의 정적 그림(PNG)을 자료(JSON)로 다시 그린 것입니다. 마우스를 올리면 값, 누르면 ② 지도로.

   ① age     : 노후년도 분포 (5년 구간, 개소/면적)               ← complexes.json
   ⑤ stack   : 종합 상위 20 — 로직별 점수 구성 (top20_danji · g13_cluster 대신)
     use     : 용도별 상위 10 막대 (top10_by_use 대신) — ⑤ 용도 탭과 같이 움직임
     weights : 용도별 가중치 프로파일 (g5_useweights 대신)
   ⑦ scatter : 30년↑ 산단 유형 — 역 거리(로그) × 쇠퇴 가중치+사업체 감소 (g3_typology 대신)
     mix     : 종합 상위 15 내부/주변 300m 건축물 용도 (g9_usemix 대신)
     heat    : A·B 쇠퇴유형 × 추천 용도 (g10_heat 대신)
     recov   : A·B 회수 가능 물량 × 종상향 방식 (g12_recov 대신)

   그리는 법: SVG 문자열 하나를 만들어 넣고, 표시(mark)마다 data-i 를 달아 말풍선·누르기를 한 곳에서 받습니다.
   폭이 바뀌면(ResizeObserver) 다시 그립니다. 색은 aging.css 의 --ag-* — 모두 「색깔파레트31」 안의 색.
   ============================================================= */
(function () {
  "use strict";
  var AG = window.AG; if (!AG) return;
  var esc = AG.esc, num = AG.num, D = AG.D;
  var S = ["var(--ag-s1)", "var(--ag-s2)", "var(--ag-s3)", "var(--ag-s4)"];   // 네 축 — aging.css (색깔파레트31 안에서)
  var USE_COLOR = { "상업용": "var(--ag-com)", "주거용": "var(--ag-res)", "업무시설용": "var(--ag-off)" };
  var OTHER = "var(--ag-other)";
  var pct = function (v) { return v == null ? "—" : Math.round(v * 100) + "%"; };

  /* ---------- 말풍선 하나를 모두가 씀 ---------- */
  var tip = document.createElement("div");
  tip.className = "ag-tip"; tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  function moveTip(e) {
    var x = e.clientX + 14, y = e.clientY + 14, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  }
  var row = function (color, k, v) { return '<div class="r"><span>' + (color ? '<i style="background:' + color + '"></i>' : "") + k + "</span><b>" + v + "</b></div>"; };

  /* ---------- 글자 폭 어림 (한글은 글자 크기만큼, 영숫자는 0.6) ---------- */
  function textW(s, fs) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2e80 ? fs : fs * 0.6; return w; }
  function clip(s, maxW, fs) {
    s = String(s || ""); if (textW(s, fs) <= maxW) return s;
    while (s.length > 1 && textW(s + "…", fs) > maxW) s = s.slice(0, -1);
    return s + "…";
  }
  function niceStep(max, n) {
    var raw = max / (n || 5), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function niceMax(max, n) { var s = niceStep(max, n); return Math.ceil(max / s) * s || s; }

  /* ---------- 차트 틀 — 카드(.ag-chart) 하나에 draw(W, state) → {svg, tip(i), click(i)} ---------- */
  function mount(card, state, draw) {
    var plot = card.querySelector(".ag-plot"), cur = null, lastW = 0;
    var render = function () {
      var W = Math.round(plot.clientWidth); if (!W) return;
      lastW = W;
      cur = draw(W, state);
      plot.innerHTML = cur ? cur.svg : '<p class="ag-chart__empty">자료가 없습니다</p>';
    };
    var target = function (e) { var g = e.target.closest("[data-i]"); return g && plot.contains(g) ? g : null; };
    var on = null;
    plot.addEventListener("mousemove", function (e) {
      var g = target(e);
      if (!g || !cur || !cur.tip) { leave(); return; }
      if (g !== on) {
        if (on) on.classList.remove("on");
        on = g; g.classList.add("on"); plot.classList.add("hovering");
        tip.innerHTML = cur.tip(+g.dataset.i); tip.classList.add("on");
      }
      moveTip(e);
    });
    var leave = function () { if (on) on.classList.remove("on"); on = null; plot.classList.remove("hovering"); tip.classList.remove("on"); };
    plot.addEventListener("mouseleave", leave);
    plot.addEventListener("click", function (e) { var g = target(e); if (g && cur && cur.click) { leave(); cur.click(+g.dataset.i); } });
    /* 머리의 고르기 단추 (data-v) */
    card.querySelectorAll(".ag-chart__head [data-v]").forEach(function (b) {
      b.addEventListener("click", function () {
        card.querySelectorAll(".ag-chart__head [data-v]").forEach(function (x) { x.classList.toggle("active", x === b); });
        state.v = b.dataset.v; render();
      });
    });
    if ("ResizeObserver" in window) new ResizeObserver(function () { if (Math.round(plot.clientWidth) !== lastW) render(); }).observe(plot);
    else window.addEventListener("resize", render);
    render();
    return { render: render };
  }
  function cardOf(name) { return document.querySelector('.ag-chart[data-chart="' + name + '"]'); }

  /* ---------- 가로 막대 (쌓기 · 묶음 머리 · 끝 알약) ----------
     rows: [{label, dim, group, segs:[{v, color}], end:{text, color, fg}, val}] — group 이 있는 줄은 머리줄 */
  function hbars(W, o) {
    var fs = 12, rowH = o.rowH || 24, barH = o.barH || 14, top = 4;
    var labs = o.rows.filter(function (r) { return !r.group; }).map(function (r) { return textW(r.label, fs); });
    var labW = Math.min(Math.max(70, Math.max.apply(null, labs.concat([0])) + 12), Math.round(W * (W < 520 ? 0.4 : 0.32)), o.labMax || 240);
    var endW = o.endW != null ? o.endW : 46;
    var x0 = labW, x1 = W - endW - 4, max = o.max;
    var X = function (v) { return x0 + Math.max(0, v) / max * (x1 - x0); };
    var y = top, body = "", i = 0;
    o.rows.forEach(function (r) {
      if (r.group) {
        y += i ? 8 : 0;
        body += '<text class="grp" x="0" y="' + (y + 15) + '">' + esc(clip(r.group, W - 4, fs)) + "</text>";
        y += 22; i++; return;
      }
      var cy = y + rowH / 2, by = cy - barH / 2, x = x0, segs = "";
      r.segs.forEach(function (s) {
        var w = X(s.v) - x0; if (w <= 0) return;
        var gw = Math.max(1, w - 2);                    // 토막 사이 2px 틈
        segs += '<rect class="mk" x="' + x.toFixed(1) + '" y="' + by + '" width="' + gw.toFixed(1) + '" height="' + barH + '" rx="2" fill="' + s.color + '"/>';
        x += w;
      });
      var end = "";
      if (r.val != null) end += '<text class="val" x="' + (x + 6).toFixed(1) + '" y="' + (cy + 4) + '">' + esc(r.val) + "</text>";
      if (r.end) {
        var ex = r.val != null ? x + 10 + textW(String(r.val), 11) : x + 6;
        end += '<rect x="' + ex.toFixed(1) + '" y="' + (cy - 8) + '" width="18" height="16" rx="4" fill="' + r.end.color + '"/>' +
               '<text x="' + (ex + 9).toFixed(1) + '" y="' + (cy + 4) + '" text-anchor="middle" style="fill:' + (r.end.fg || "#fff") + ';font-size:11px;font-weight:700">' + esc(r.end.text) + "</text>";
      }
      body += '<g class="row" data-i="' + r.i + '"><rect class="hit" x="0" y="' + y + '" width="' + W + '" height="' + rowH + '" rx="4"/>' +
        '<text class="lab' + (r.dim ? " dim" : "") + '" x="' + (labW - 8) + '" y="' + (cy + 4) + '" text-anchor="end">' + esc(clip(r.label, labW - 12, fs)) + "</text>" + segs + end + "</g>";
      y += rowH;
    });
    /* 아래 눈금 */
    var step = niceStep(max, W < 520 ? 3 : 5), axis = '<g class="ax">';
    for (var t = 0; t <= max + 1e-9; t += step) {
      var tx = X(t).toFixed(1);
      axis += '<line x1="' + tx + '" x2="' + tx + '" y1="' + top + '" y2="' + y + '"/><text x="' + tx + '" y="' + (y + 14) + '" text-anchor="middle">' + num(Math.round(t * 10) / 10) + "</text>";
    }
    axis += '<line class="base" x1="' + x0 + '" x2="' + x0 + '" y1="' + top + '" y2="' + y + '"/></g>';
    var h = y + (o.xTitle ? 32 : 20);
    var ttl = o.xTitle ? '<text class="ttl" x="' + x1 + '" y="' + (y + 29) + '" text-anchor="end">' + esc(o.xTitle) + "</text>" : "";
    return '<svg viewBox="0 0 ' + W + " " + h + '" role="img" aria-label="' + esc(o.aria || "") + '">' + axis + body + ttl + "</svg>";
  }
  function keys(list) { return '<div class="ag-keys">' + list.map(function (k) { return "<span><i" + (k.c ? ' class="c"' : "") + ' style="background:' + k.color + '"></i>' + esc(k.label) + "</span>"; }).join("") + "</div>"; }
  var gradePill = function (g) { return g ? { text: g, color: AG.GRADE_COLOR[g] || "#999", fg: g === "C" ? "#2b2422" : "#fff" } : null; };

  /* ---------- 자료 ---------- */
  Promise.all([
    AG.getJSON(D + "complexes.json"),
    AG.getJSON(D + "analysis/ranking_all.json"),
    AG.getJSON(D + "analysis/ranking_top10_by_use.json"),
  ]).then(function (r) {
    var cx = r[0].features.map(function (f) { return f.properties; });
    var cxName = {}; cx.forEach(function (p) { cxName[p.id] = p.name; });
    var meta = r[1].meta || {}, items = r[1].items || [], top = r[2];
    var short = function (u) { return (u.unit_id && u.unit_id.indexOf("D_") === 0 && cxName[u.unit_id.slice(2)]) || String(u.name || "").split(" / ")[0]; };
    var LOGIC = Object.keys(meta["로직가중치"] || {});           // 「① 노후도(30)」 … 네 축
    var logicName = function (k) { return k.replace(/^[①-④]\s*/, ""); };
    var go = function (u) { if (u && u.unit_id) AG.focusUnit(u.unit_id); };

    chartAge(cx);
    chartStack(items, LOGIC, logicName, short, go);
    chartUse(top, short, go);
    chartWeights(meta, LOGIC, logicName);
    chartScatter(items, short, go, LOGIC[0]);
    chartMix(items, short, go);
    chartHeat(items, short);
    chartRecov(items, short, go);
  }).catch(function (e) {
    console.error(e);
    document.querySelectorAll(".ag-chart .ag-plot").forEach(function (p) { p.innerHTML = '<p class="ag-chart__empty">차트 자료를 불러오지 못했습니다 — ' + esc(e.message) + "</p>"; });
  });

  /* ① 노후년도 분포 — 세로 막대 (5년 구간) */
  function chartAge(cx) {
    var card = cardOf("age"); if (!card) return;
    var B = 5, bins = [];
    for (var a = 0; a < 65; a += B) bins.push({ a: a, n: 0, ha: 0, list: [] });
    var none = 0;
    cx.forEach(function (p) {
      if (!p.matched || p.age == null) { none++; return; }
      var b = bins[Math.min(bins.length - 1, Math.floor(p.age / B))];
      b.n++; b.ha += (p.area || 0) / 10000; b.list.push(p);
    });
    bins.forEach(function (b) { b.list.sort(function (x, y) { return (y.area || 0) - (x.area || 0); }); });
    mount(card, { v: "n" }, function (W, st) {
      var key = st.v, val = function (b) { return key === "n" ? b.n : b.ha; };
      var max = niceMax(Math.max.apply(null, bins.map(val)), 4), H = 240, pl = 44, pr = 8, pt = 10, pb = 40;
      var cw = (W - pl - pr) / bins.length, bw = Math.max(6, cw - 4);
      var Y = function (v) { return pt + (1 - v / max) * (H - pt - pb); };
      var step = niceStep(max, 4), ax = '<g class="ax">';
      for (var t = 0; t <= max + 1e-9; t += step) ax += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"/><text x="' + (pl - 6) + '" y="' + (Y(t) + 4).toFixed(1) + '" text-anchor="end">' + num(Math.round(t)) + "</text>";
      ax += '<line class="base" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
      var body = "";
      bins.forEach(function (b, i) {
        var x = pl + i * cw + (cw - bw) / 2, v = val(b), y = Y(v), h = Y(0) - y;
        if (i % (W < 520 ? 2 : 1) === 0) ax += '<text x="' + (pl + i * cw).toFixed(1) + '" y="' + (H - pb + 15) + '" text-anchor="middle">' + b.a + "</text>";   // 구간 경계에 눈금
        body += '<g class="row" data-i="' + i + '"><rect class="hit" x="' + (pl + i * cw).toFixed(1) + '" y="' + pt + '" width="' + cw.toFixed(1) + '" height="' + (H - pt - pb) + '"/>' +
          (h > 0 ? '<path class="mk" d="' + topRound(x, y, bw, h, 4) + '" fill="' + AG.ageColor(b.a + B / 2) + '" stroke="rgba(0,0,0,.25)" stroke-width="1"/>' : "") +
          (v ? '<text class="val" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle">' + num(Math.round(v)) + "</text>" : "") + "</g>";
      });
      /* 30년 경계선 — 「노후」 기준 */
      var x30 = pl + (30 / B) * cw;
      body += '<line class="guide" x1="' + x30 + '" x2="' + x30 + '" y1="' + pt + '" y2="' + Y(0) + '"/><text class="quad" x="' + (x30 + 6) + '" y="' + (pt + 12) + '">30년 이상 →</text>';
      ax += '<text class="ttl" x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">노후년도 (년)' + (none ? " · 목록 짝 없는 " + none + "곳 제외" : "") + "</text></g>";
      return {
        svg: '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="노후년도 분포">' + ax + body + "</svg>",
        tip: function (i) {
          var b = bins[i];
          return "<b>" + b.a + "–" + (b.a + B - 1) + "년</b>" + row(null, "산단", b.n + "곳") + row(null, "면적", num(Math.round(b.ha)) + " ha") +
            (b.list.length ? '<div class="m">' + b.list.slice(0, 5).map(function (p) { return esc(p.name); }).join(" · ") + (b.list.length > 5 ? " 외 " + (b.list.length - 5) : "") + "</div>" : "");
        },
      };
    });
  }
  /* 위 모서리만 둥근 막대 (아래는 기준선에 붙음) */
  function topRound(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return "M" + x.toFixed(1) + "," + (y + h).toFixed(1) + "V" + (y + r).toFixed(1) + "Q" + x.toFixed(1) + "," + y.toFixed(1) + " " + (x + r).toFixed(1) + "," + y.toFixed(1) +
      "H" + (x + w - r).toFixed(1) + "Q" + (x + w).toFixed(1) + "," + y.toFixed(1) + " " + (x + w).toFixed(1) + "," + (y + r).toFixed(1) + "V" + (y + h).toFixed(1) + "Z";
  }

  /* ⑤ 종합 상위 20 — 로직별 쌓은 막대 */
  function chartStack(items, LOGIC, logicName, short, go) {
    var card = cardOf("stack"); if (!card || !LOGIC.length) return;
    var plotKeys = keys(LOGIC.map(function (k, i) { return { color: S[i], label: logicName(k) }; }));
    card.querySelector(".ag-plot").insertAdjacentHTML("afterend", plotKeys);
    var pick = {
      core: function (x) { return x.unit_type === "산업단지" && x["핵심필터_30년노후"]; },
      danji: function (x) { return x.unit_type === "산업단지"; },
      cluster: function (x) { return x.unit_type !== "산업단지"; },
    };
    mount(card, { v: "core" }, function (W, st) {
      var L2 = items.filter(pick[st.v]).sort(function (a, b) { return (b["종합점수"] || 0) - (a["종합점수"] || 0); }).slice(0, 20);
      if (!L2.length) return null;
      var rows = L2.map(function (u, i) {
        return { i: i, label: short(u), segs: LOGIC.map(function (k, j) { return { v: u[k] || 0, color: S[j] }; }), val: u["종합점수"], end: gradePill(u["등급"]), dim: /미충족/.test(u["판정사유"] || "") };
      });
      return {
        svg: hbars(W, { rows: rows, max: niceMax(L2[0]["종합점수"] || 10, 5), rowH: 22, barH: 13, endW: 62, xTitle: "종합점수 (100점 만점)", aria: "종합 상위 20 로직별 점수" }),
        tip: function (i) {
          var u = L2[i];
          return "<b>" + esc(short(u)) + "</b> " + (u["시군"] ? '<span class="ag-mute">' + esc(u["시군"]) + "</span>" : "") +
            LOGIC.map(function (k, j) { return row(S[j], esc(logicName(k)), (Math.round((u[k] || 0) * 10) / 10)); }).join("") +
            row(null, "종합", u["종합점수"] + " · " + (u["등급"] || "—") + "등급") +
            '<div class="m">' + esc(u["추천용도"] || "") + (u["노후년도"] ? " · 노후 " + Math.round(u["노후년도"]) + "년" : "") + " · 누르면 지도에서</div>";
        },
        click: function (i) { go(L2[i]); },
      };
    });
  }

  /* ⑤ 용도별 상위 10 — ⑤ 탭(ag:use)과 같이 */
  function chartUse(top, short, go) {
    var card = cardOf("use"); if (!card) return;
    var all = []; Object.keys(top).forEach(function (u) { (top[u] || []).forEach(function (x) { all.push(x["점수"] || 0); }); });
    var max = niceMax(Math.max.apply(null, all.concat([10])), 5);
    var st = { v: "상업용" };
    var m = mount(card, st, function (W, s) {
      var L2 = (top[s.v] || []).slice().sort(function (a, b) { return (b["점수"] || 0) - (a["점수"] || 0); });
      var h = document.getElementById("ag-use-h"); if (h) h.textContent = s.v + " 점수 상위 10";
      return {
        svg: hbars(W, { rows: L2.map(function (u, i) { return { i: i, label: short(u), segs: [{ v: u["점수"] || 0, color: USE_COLOR[s.v] }], val: u["점수"], end: gradePill(u["등급"]) }; }), max: max, rowH: 26, endW: 62, xTitle: s.v + " 점수", aria: s.v + " 상위 10" }),
        tip: function (i) {
          var u = L2[i];
          return "<b>" + esc(short(u)) + "</b> " + (u["시군"] ? '<span class="ag-mute">' + esc(u["시군"]) + "</span>" : "") +
            row(USE_COLOR[s.v], esc(s.v) + " 점수", u["점수"]) + row(null, "등급", u["등급"] || "—") +
            row(null, "최근접역", u.nearest_station ? esc(u.nearest_station) + " " + num(Math.round(u.dist_station_m || 0)) + " m" : "—") +
            row(null, "주변 300m 주거/상업", pct(u.ring_res_ratio) + " / " + pct(u.ring_com_ratio)) +
            '<div class="m">' + esc(u["종상향_방식"] || "") + "</div>";
        },
        click: function (i) { go((top[s.v] || []).slice().sort(function (a, b) { return (b["점수"] || 0) - (a["점수"] || 0); })[i]); },
      };
    });
    document.addEventListener("ag:use", function (e) { st.v = e.detail; m.render(); });
  }

  /* ⑤ 용도별 가중치 프로파일 — 지표 × (종합·상업·주거·업무) 칸 */
  function chartWeights(meta, LOGIC, logicName) {
    var card = cardOf("weights"); if (!card) return;
    var lw = meta["로직가중치"] || {}, uw = meta["용도별가중치"] || {};
    var COLS = ["종합"].concat(Object.keys(uw));
    var rows = [], seen = {};
    LOGIC.forEach(function (g, gi) { Object.keys(lw[g]).forEach(function (k) { rows.push({ k: k, g: gi }); seen[k] = 1; }); });
    Object.keys(uw).forEach(function (u) { Object.keys(uw[u]).forEach(function (k) { if (!seen[k]) { rows.push({ k: k, g: -1 }); seen[k] = 1; } }); });
    var val = function (r, c) { if (c === "종합") { var g = LOGIC[r.g]; return g ? lw[g][r.k] : null; } return (uw[c] || {})[r.k]; };
    var max = 0; rows.forEach(function (r) { COLS.forEach(function (c) { var v = val(r, c); if (v > max) max = v; }); });
    var st = { v: "상업용" };
    var m = mount(card, st, function (W) {
      var fs = 12, rowH = 20, labW = Math.min(150, Math.max.apply(null, rows.map(function (r) { return textW(AG.NAMES[r.k] || r.k, fs); })) + 22);
      var cw = (W - labW) / COLS.length, top = 22, body = "", cells = [];
      COLS.forEach(function (c, j) {
        body += '<text x="' + (labW + j * cw + cw / 2).toFixed(1) + '" y="14" text-anchor="middle" style="font-size:11px;font-weight:' + (c === st.v ? 700 : 400) + ';fill:' + (c === st.v ? "var(--ink)" : "var(--ag-faint)") + '">' + esc(c.replace("시설용", "").replace("용", "")) + "</text>";
      });
      /* 고른 용도 열 — 옅은 띠 */
      var sj = COLS.indexOf(st.v);
      if (sj >= 0) body += '<rect x="' + (labW + sj * cw).toFixed(1) + '" y="' + (top - 3) + '" width="' + cw.toFixed(1) + '" height="' + (rows.length * rowH + 6) + '" rx="6" fill="none" stroke="var(--ink)" stroke-width="1.5"/>';
      rows.forEach(function (r, i) {
        var y = top + i * rowH;
        body += '<rect x="0" y="' + (y + 4) + '" width="4" height="' + (rowH - 8) + '" rx="2" fill="' + (r.g >= 0 ? S[r.g] : OTHER) + '"/>' +
          '<text class="lab" x="10" y="' + (y + 14) + '">' + esc(clip(AG.NAMES[r.k] || r.k, labW - 16, fs)) + "</text>";
        COLS.forEach(function (c, j) {
          var v = val(r, c), k = cells.length;
          cells.push({ r: r, c: c, v: v });
          var t = v ? v / max : 0, fill = v ? "color-mix(in oklab, var(--ag-seq) " + Math.round(12 + t * 88) + "%, #fff)" : "var(--paper-2)";
          body += '<g data-i="' + k + '"><rect class="cell mk" x="' + (labW + j * cw + 1).toFixed(1) + '" y="' + (y + 1) + '" width="' + (cw - 2).toFixed(1) + '" height="' + (rowH - 2) + '" rx="3" fill="' + fill + '"/>' +
            (v ? '<text class="cellv" x="' + (labW + j * cw + cw / 2).toFixed(1) + '" y="' + (y + 14) + '" text-anchor="middle" style="fill:' + (t > 0.5 ? "#fff" : "var(--ink)") + '">' + v + "</text>" : "") + "</g>";
        });
      });
      var H = top + rows.length * rowH + 6;
      return {
        svg: '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="용도별 가중치">' + body + "</svg>",
        tip: function (i) { var x = cells[i]; return "<b>" + esc(AG.NAMES[x.r.k] || x.r.k) + "</b>" + row(null, esc(x.c), x.v ? x.v + "점" : "쓰지 않음") + '<div class="m">' + (x.r.g >= 0 ? esc(logicName(LOGIC[x.r.g])) + " 축" : "용도 점수에만 쓰는 지표") + "</div>"; },
      };
    });
    card.querySelector(".ag-plot").insertAdjacentHTML("afterend", keys(LOGIC.map(function (k, i) { return { color: S[i], label: logicName(k) }; }).concat([{ color: OTHER, label: "용도 점수 전용" }])));
    document.addEventListener("ag:use", function (e) { st.v = e.detail; m.render(); });
  }

  /* ⑦ 30년↑ 산단 유형 — 논문 g3_typology 와 같은 축:
       x = 최근접 철도역 거리(m, 로그), y = 도시쇠퇴 활용도 가중치 + 사업체 감소율
       기준선 역세권 1.5km · 산업계 쇠퇴 0.6 → 네 칸이 ⑦ 유형화 표의 Ⅰ~Ⅳ */
  function chartScatter(items, short, go, aging) {   // aging = 노후도 축 열쇠 (「① 노후도(30)」)
    var card = cardOf("scatter"); if (!card) return;
    var GX = 1500, GY = 0.6, X0 = 10;
    var pts = items.filter(function (x) { return x.unit_type === "산업단지" && x["핵심필터_30년노후"] && x.dist_station_m != null; });
    var yv = function (u) { return (u.decl_w || 0) + (u.busi_decline || 0); };
    var grades = ["A", "B", "C", "D"];
    card.querySelector(".ag-plot").insertAdjacentHTML("afterend", keys(grades.map(function (g) { return { color: AG.GRADE_COLOR[g], label: g + " " + AG.GRADE_TXT[g], c: true }; })) +
      '<p class="ag-note">x 는 로그 눈금(역에 붙은 곳은 10 m 에 둠). 활용 잠재력 = 도시쇠퇴 8유형의 활용도 가중치(산업쇠퇴 1.0 · 산업건물·인구산업 0.8 · 절대쇠퇴 0.6 · 인구건물 0.35 · 건물·인구 0.3 · 성장 0) + 행정동 사업체 감소율(최대치 대비). 0.6 선 위가 산업계 쇠퇴(산업쇠퇴·산업건물·인구산업·절대쇠퇴) 행정동이고, 같은 유형 안에서는 사업체가 많이 줄수록 위로 갑니다. 점선은 역세권 1.5 km.</p>');
    mount(card, {}, function (W) {
      var H = Math.max(340, Math.min(480, W * 0.52)), pl = 64, pr = 16, pt = 16, pb = 40;
      var lx = function (m) { return Math.log10(Math.max(X0, m)); };
      var xmax = Math.pow(10, Math.ceil(lx(Math.max.apply(null, pts.map(function (u) { return u.dist_station_m; }))) * 2) / 2);
      var ys = pts.map(yv), ymin = Math.floor((Math.min.apply(null, ys) - 0.05) * 10) / 10, ymax = Math.ceil((Math.max.apply(null, ys) + 0.08) * 10) / 10;
      var X = function (m) { return pl + (lx(m) - lx(X0)) / (lx(xmax) - lx(X0)) * (W - pl - pr); };
      var Y = function (v) { return pt + (1 - (v - ymin) / (ymax - ymin)) * (H - pt - pb); };
      var amax = Math.max.apply(null, pts.map(function (x) { return x.area_ha || 0; }));
      var R = function (a) { return 4 + Math.sqrt((a || 0) / amax) * 18; };
      var fmtD = function (m) { return m >= 1000 ? (m / 1000) + "km" : m + "m"; };
      var ax = '<g class="ax">';
      [10, 30, 100, 300, 1000, 3000, 10000, 30000].filter(function (t) { return t <= xmax; }).forEach(function (t) {
        var major = String(t)[0] === "1";
        ax += '<line x1="' + X(t).toFixed(1) + '" x2="' + X(t).toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb) + '"' + (major ? "" : ' style="stroke-dasharray:2 3"') + '/>' +
          (major || W > 560 ? '<text x="' + X(t).toFixed(1) + '" y="' + (H - pb + 15) + '" text-anchor="middle">' + fmtD(t) + "</text>" : "");
      });
      for (var t = Math.ceil(ymin * 5) / 5; t <= ymax + 1e-9; t += 0.2) ax += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"/><text x="' + (pl - 6) + '" y="' + (Y(t) + 4).toFixed(1) + '" text-anchor="end">' + t.toFixed(1) + "</text>";
      ax += '<text class="ttl" x="' + (W - pr) + '" y="' + (H - 6) + '" text-anchor="end">최근접 철도역 거리 (로그) →</text>' +
        /* y 축 이름 — 세로로 (논문 그림처럼) */
        '<text class="ttl" transform="translate(14,' + ((pt + H - pb) / 2).toFixed(1) + ') rotate(-90)" text-anchor="middle" style="font-size:12px;fill:var(--ag-text2)">' +
          '<tspan style="font-weight:700">활용 잠재력</tspan>' + (H > 380 ? '<tspan> (도시쇠퇴 활용도 가중치 + 사업체 감소율)</tspan>' : "") + "</text></g>";
      /* 기준선 · 네 칸 이름 (⑦ 유형화 표와 같은 번호) */
      var gx = X(GX), gy = Y(GY), q = function (x, y, anc, t) { return '<text class="quad" x="' + x + '" y="' + y + '" text-anchor="' + anc + '">' + t + "</text>"; };
      var guides = '<line class="guide" x1="' + gx + '" x2="' + gx + '" y1="' + pt + '" y2="' + (H - pb) + '"/><line class="guide" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + gy + '" y2="' + gy + '"/>' +
        q(pl + 6, pt + 12, "start", "Ⅰ 역세권·산업쇠퇴") + q(W - pr - 4, pt + 12, "end", "Ⅲ 비역세권·산업쇠퇴") +
        q(pl + 6, H - pb - 22, "start", "Ⅱ 역세권·비쇠퇴") + q(W - pr - 4, H - pb - 22, "end", "Ⅳ 비역세권·비쇠퇴") +
        q(gx + 4, H - pb - 6, "start", "역세권 1.5km") + q(W - pr - 4, gy - 5, "end", "산업계 쇠퇴 기준 0.6");
      /* 큰 점을 먼저 — 작은 점이 위에 */
      var order = pts.map(function (_, i) { return i; }).sort(function (a, b) { return (pts[b].area_ha || 0) - (pts[a].area_ha || 0); });
      var dots = "";
      order.forEach(function (i) {
        var u = pts[i];
        dots += '<circle class="dot mk" data-i="' + i + '" cx="' + X(u.dist_station_m).toFixed(1) + '" cy="' + Y(yv(u)).toFixed(1) + '" r="' + R(u.area_ha).toFixed(1) + '" fill="' + (AG.GRADE_COLOR[u["등급"]] || "#999") + '" fill-opacity=".85"/>';
      });
      /* 이름표 — A·B 와 넓은 산단 몇, 겹치면 건너뜀 */
      var boxes = [], labels = "";
      var want = pts.map(function (u, i) { return i; }).filter(function (i) { var g = pts[i]["등급"]; return g === "A" || g === "B"; })
        .concat(order.slice(0, 5)).filter(function (i, k, a) { return a.indexOf(i) === k; });
      want.forEach(function (i) {
        var u = pts[i], r = R(u.area_ha), nm = clip(short(u), 110, 11), w = textW(nm, 11);
        var x = X(u.dist_station_m) + r + 3, y = Y(yv(u)) - r * 0.4;
        if (x + w > W - pr) x = X(u.dist_station_m) - r - 3 - w;
        var bx = [x - 1, y - 11, x + w + 1, y + 3];
        if (boxes.some(function (b) { return !(bx[2] < b[0] || bx[0] > b[2] || bx[3] < b[1] || bx[1] > b[3]); })) return;
        boxes.push(bx);
        labels += '<text class="val" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" style="font-weight:600;paint-order:stroke;stroke:#fff;stroke-width:3px;pointer-events:none">' + esc(nm) + "</text>";
      });
      return {
        svg: '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="30년 이상 산단 유형 산점도">' + ax + guides + dots + labels + "</svg>",
        tip: function (i) {
          var u = pts[i];
          return "<b>" + esc(short(u)) + "</b> " + (u["시군"] ? '<span class="ag-mute">' + esc(u["시군"]) + "</span>" : "") +
            row(null, "노후년도", u["노후년도"] != null ? "지정 후 " + Math.round(u["노후년도"]) + "년" : "—") +
            row(null, "30년 이상 건물", pct(u.old30_ratio_gfa) + ' <span class="ag-mute">(연면적)</span>') +
            (aging ? row(S[0], "노후도 점수", (Math.round((u[aging] || 0) * 10) / 10) + " / 30") : "") +
            row(null, "최근접역", esc(u.nearest_station || "") + " " + num(Math.round(u.dist_station_m)) + " m") +
            row(null, "쇠퇴 가중치", (u.decl_w != null ? u.decl_w : "—") + " · " + esc((u.decl_class || "—").replace("지역", ""))) +
            row(null, "사업체 감소", u.busi_decline == null ? "자료 없음" : "↓" + Math.round(u.busi_decline * 100) + "%") +
            row(null, "활용 잠재력", "<b>" + yv(u).toFixed(2) + "</b>") +
            row(null, "면적", num(Math.round(u.area_ha || 0)) + " ha") +
            row(AG.GRADE_COLOR[u["등급"]], "등급 · 점수", (u["등급"] || "—") + " · " + u["종합점수"]) +
            '<div class="m">' + esc(u["추천용도"] || "") + " · 누르면 지도에서</div>";
        },
        click: function (i) { go(pts[i]); },
      };
    });
  }

  /* ⑦ 종합 상위 15 — 내부 / 주변 300m 건축물 용도 (100% 쌓기) */
  function chartMix(items, short, go) {
    var card = cardOf("mix"); if (!card) return;
    var L2 = items.filter(function (x) { return x.unit_type === "산업단지" && x["핵심필터_30년노후"]; })
      .sort(function (a, b) { return (b["종합점수"] || 0) - (a["종합점수"] || 0); }).slice(0, 15);
    var PARTS = [{ k: "주거", c: USE_COLOR["주거용"] }, { k: "상업", c: USE_COLOR["상업용"] }, { k: "업무", c: USE_COLOR["업무시설용"] }, { k: "공업·기타", c: OTHER }];
    var split = function (a, b, c) {
      if (a == null && b == null && c == null) return null;
      a = a || 0; b = b || 0; c = c || 0;
      return [a, b, c, Math.max(0, 1 - a - b - c)];
    };
    var rec = [];
    L2.forEach(function (u) {
      rec.push({ u: u, side: "단지 안", p: split(u.res_gfa_ratio, u.com_gfa_ratio, u.off_gfa_ratio) });
      rec.push({ u: u, side: "주변 300m", p: split(u.ring_res_ratio, u.ring_com_ratio, u.ring_off_ratio) });
    });
    card.querySelector(".ag-plot").insertAdjacentHTML("afterend", keys(PARTS.map(function (p) { return { color: p.c, label: p.k }; })));
    mount(card, {}, function (W) {
      var rows = rec.map(function (x, i) {
        return { i: i, label: x.side === "단지 안" ? short(x.u) : "└ 주변 300m", dim: x.side !== "단지 안",
          segs: x.p ? x.p.map(function (v, j) { return { v: v * 100, color: PARTS[j].c }; }) : [], val: x.p ? null : "자료 없음" };
      });
      return {
        svg: hbars(W, { rows: rows, max: 100, rowH: 18, barH: 12, endW: 8, xTitle: "연면적 구성 (%)", aria: "상위 15 산단 내부와 주변의 건축물 용도" }),
        tip: function (i) {
          var x = rec[i];
          return "<b>" + esc(short(x.u)) + "</b> · " + x.side + (x.p ? PARTS.map(function (p, j) { return row(p.c, p.k, Math.round(x.p[j] * 100) + "%"); }).join("") : '<div class="m">용도를 확인한 건물이 없습니다</div>') +
            '<div class="m">종합 ' + x.u["종합점수"] + "점 · " + (x.u["등급"] || "—") + "등급 · " + esc(x.u["추천용도"] || "") + "</div>";
        },
        click: function (i) { go(rec[i].u); },
      };
    });
  }

  /* ⑦ A·B — 쇠퇴유형 × 추천 용도 칸 */
  function chartHeat(items, short) {
    var card = cardOf("heat"); if (!card) return;
    var ab = items.filter(function (x) { return x["등급"] === "A" || x["등급"] === "B"; });
    var COLS = ["상업용", "주거용", "업무시설용"].filter(function (c) { return ab.some(function (x) { return x["추천용도"] === c; }); });
    ab.forEach(function (x) { if (COLS.indexOf(x["추천용도"]) < 0) COLS.push(x["추천용도"] || "—"); });
    var cnt = {}; ab.forEach(function (x) { var d = x.decl_class || "자료 없음"; cnt[d] = (cnt[d] || 0) + 1; });
    var ROWS = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
    var cell = function (r, c) { return ab.filter(function (x) { return (x.decl_class || "자료 없음") === r && (x["추천용도"] || "—") === c; }); };
    var max = 1; ROWS.forEach(function (r) { COLS.forEach(function (c) { max = Math.max(max, cell(r, c).length); }); });
    mount(card, {}, function (W) {
      var fs = 12, rowH = 34, labW = Math.min(150, Math.max.apply(null, ROWS.map(function (r) { return textW(r.replace("지역", ""), fs); })) + 14);
      var cw = (W - labW - 40) / COLS.length, top = 24, body = "", cells = [];
      COLS.forEach(function (c, j) { body += '<text x="' + (labW + j * cw + cw / 2).toFixed(1) + '" y="15" text-anchor="middle" style="font-size:12px;font-weight:700;fill:' + (USE_COLOR[c] ? "var(--ink)" : "var(--ag-faint)") + '">' + esc(c) + "</text>"; });
      ROWS.forEach(function (r, i) {
        var y = top + i * rowH;
        body += '<text class="lab" x="' + (labW - 8) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end">' + esc(clip(r.replace("지역", ""), labW - 12, fs)) + "</text>";
        COLS.forEach(function (c, j) {
          var L2 = cell(r, c), n = L2.length, k = cells.length, t = n / max;
          cells.push({ r: r, c: c, L: L2 });
          body += '<g data-i="' + k + '"><rect class="cell mk" x="' + (labW + j * cw + 1).toFixed(1) + '" y="' + (y + 1) + '" width="' + (cw - 2).toFixed(1) + '" height="' + (rowH - 2) + '" rx="4" fill="' + (n ? "color-mix(in oklab, var(--ag-seq) " + Math.round(15 + t * 85) + "%, #fff)" : "var(--paper-2)") + '"/>' +
            (n ? '<text class="cellv" x="' + (labW + j * cw + cw / 2).toFixed(1) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="middle" style="font-size:13px;font-weight:700;fill:' + (t > 0.5 ? "#fff" : "var(--ink)") + '">' + n + "</text>" : "") + "</g>";
        });
        body += '<text class="val" x="' + (W - 4) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end">' + cnt[r] + "</text>";
      });
      var H = top + ROWS.length * rowH + 4;
      return {
        svg: '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="쇠퇴유형과 추천 용도">' + body + "</svg>",
        tip: function (i) {
          var x = cells[i];
          return "<b>" + esc(x.r) + " × " + esc(x.c) + "</b>" + row(null, "단위", x.L.length + "곳") +
            (x.L.length ? '<div class="m">' + x.L.map(function (u) { return esc(short(u)) + " (" + u["등급"] + ")"; }).join(" · ") + "</div>" : "");
        },
      };
    });
  }

  /* ⑦ A·B — 회수 가능 공업지역 물량, 종상향 방식으로 묶음 */
  function chartRecov(items, short, go) {
    var card = cardOf("recov"); if (!card) return;
    var ab = items.filter(function (x) { return (x["등급"] === "A" || x["등급"] === "B") && x["회수가능_공업지역_ha"] > 0; });
    var groups = {};
    ab.forEach(function (x) { var g = x["종상향_방식"] || "방식 미정"; (groups[g] = groups[g] || []).push(x); });
    var sum = function (L) { return L.reduce(function (a, x) { return a + x["회수가능_공업지역_ha"]; }, 0); };
    var G = Object.keys(groups).sort(function (a, b) { return sum(groups[b]) - sum(groups[a]); });
    var flat = [];
    G.forEach(function (g) { groups[g].sort(function (a, b) { return b["회수가능_공업지역_ha"] - a["회수가능_공업지역_ha"]; }); groups[g].forEach(function (x) { flat.push(x); }); });
    var max = niceMax(Math.max.apply(null, flat.map(function (x) { return x["회수가능_공업지역_ha"]; }).concat([1])), 4);
    card.querySelector(".ag-plot").insertAdjacentHTML("afterend", keys(["A", "B"].map(function (g) { return { color: AG.GRADE_COLOR[g], label: g + " " + AG.GRADE_TXT[g] }; })) +
      '<p class="ag-note">A·B ' + flat.length + "곳 · 모두 " + num(Math.round(sum(flat))) + " ha</p>");
    mount(card, {}, function (W) {
      var rows = [], i = 0;
      G.forEach(function (g) {
        rows.push({ group: g + " — " + num(Math.round(sum(groups[g]))) + " ha" });
        groups[g].forEach(function (x) { rows.push({ i: i++, label: short(x), segs: [{ v: x["회수가능_공업지역_ha"], color: AG.GRADE_COLOR[x["등급"]] }], val: num(Math.round(x["회수가능_공업지역_ha"] * 10) / 10) }); });
      });
      return {
        svg: hbars(W, { rows: rows, max: max, rowH: 20, barH: 12, endW: 40, labMax: 150, xTitle: "회수 가능 공업지역 (ha)", aria: "A·B 회수 가능 물량" }),
        tip: function (k) {
          var x = flat[k];
          return "<b>" + esc(short(x)) + "</b> " + (x["시군"] ? '<span class="ag-mute">' + esc(x["시군"]) + "</span>" : "") +
            row(AG.GRADE_COLOR[x["등급"]], "등급 · 점수", x["등급"] + " · " + x["종합점수"]) + row(null, "회수 가능", num(Math.round(x["회수가능_공업지역_ha"] * 10) / 10) + " ha") +
            row(null, "추천", esc(x["추천용도"] || "—")) + '<div class="m">' + esc(x["종상향_방식"] || "") + "</div>";
        },
        click: function (k) { go(flat[k]); },
      };
    });
  }
})();
