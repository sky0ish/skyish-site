// ─── Contact 「Cost of Living」 — 카드 이용내역으로 본 생활비 ─────────────────
//
//  「달마다 얼마큼씩 쓰는지 … 사용하는 항목별로 통계를 내줘. 매달마다!
//    1년치를 한꺼번에 볼 수 있게 … 항목별로 1년치 그래프 … 선의 색을 달리해서
//    증가하는지 감소하는지 알 수 있게」
//
//  · 「📂 카드내역 읽기」 — 10.장보기/카드내역 의 엑셀(카드사 「이용내역조회」)을 이 브라우저가 읽습니다.
//  · 카드 내역은 **이 브라우저에만** 둡니다 (localStorage). 서버·GitHub 로 가지 않습니다.
//    카드번호 · 승인번호는 읽지도 않습니다.
//  · 관리자만 봅니다.
import { currentUser, myProfile } from "../../auth/auth.js";
import * as C from "./cost-parse.js?v=202610040400";
import * as FK from "./fs-keep.js?v=202609250900";

const XLSX_LIB = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
const K_PRIV = "skyish-cost-priv";            // 가게 이름 규칙 (10.장보기/카드내역/가맹점분류.json)
const K_TX = "skyish-cost-tx", K_FIX = "skyish-cost-fix", K_HIDE = "skyish-cost-hide", K_META = "skyish-cost-meta";
const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const ymLabel = (ym) => (+ym.slice(5)) + "월";

export async function initCost(mountId = "costapp", sectionId = "costsec") {
  const mount = document.getElementById(mountId);
  if (!mount) return false;
  const section = document.getElementById(sectionId);
  const user = await currentUser();
  const me = user ? await myProfile().catch(() => null) : null;
  const mail = ((user && user.email) || "").toLowerCase();
  if (!((me && me.is_admin) || OWNERS.indexOf(mail) >= 0)) { if (section) section.remove(); else mount.remove(); return false; }

  let tx = get(K_TX, []), fix = get(K_FIX, {}), hide = get(K_HIDE, []), meta = get(K_META, {});
  C.setPrivate(get(K_PRIV, {}));
  let sel = "";                      // 펼쳐 볼 달 (YYYY-MM)
  let showTotal = true;
  let focus = "";                    // 눌러서 강조한 항목 (상세가 아래에 펼쳐짐)
  let animate = true;                // 처음 그릴 때만 선이 그려지는 움직임
  let lastX = null, lastStx = [];
  /* 「대분류」 · 「세부」 — 그래프를 어느 묶음으로 볼지 (이 브라우저에 기억) */
  let level = get("skyish-cost-level", "big");
  const isG = (k) => String(k).startsWith("g:");
  const nameOf = (k) => isG(k) ? C.GROUP_NAME[k.slice(2)] : C.CAT_NAME[k];
  const colorOf = (k) => isG(k) ? C.GROUP_COLOR[k.slice(2)] : C.CAT_COLOR[k];
  const inFocus = (catK) => isG(focus) ? C.GROUP_OF[catK] === focus.slice(2) : catK === focus;

  mount.innerHTML =
    '<div class="col">' +
      '<div class="col__bar">' +
        '<button type="button" class="nbtn nbtn--go" id="colRead" title="10.장보기/카드내역 폴더의 엑셀을 읽습니다 (Shift 를 누른 채 누르면 폴더를 새로 고릅니다)">📂 카드내역 읽기</button>' +
        '<span class="col__meta" id="colMeta"></span>' +
      "</div>" +
      '<p class="col__note">카드 내역은 <b>이 컴퓨터 브라우저에만</b> 저장됩니다 — 서버나 GitHub 로 올라가지 않습니다. 카드번호·승인번호는 읽지 않습니다.</p>' +
      '<div class="col__cards" id="colCards"></div>' +
      '<h3 class="gro__h">항목별 1년 흐름 <small>— 마우스를 올리면 그 달 금액 · 선을 누르면 그 항목 상세 · 아래 단추로 선 끄고 켜기</small></h3>' +
      '<div class="col__legend" id="colLegend"></div>' +
      '<div class="col__chart" id="colChart"></div>' +
      '<div id="colCat"></div>' +
      '<h3 class="gro__h">매달 항목별 <small>— 단위 천원 · 항목 이름을 누르면 그래프에서 그 선만 · 달을 누르면 그 달 자세히</small></h3>' +
      '<p class="col__how"><b>추세</b> = 최근 3달 한 달 평균이 그 앞 3달 한 달 평균보다 몇 % 늘었나(▲)·줄었나(▼). ' +
      '월별 증가율의 평균이 아닙니다 — 한 달씩은 오르내림이 커서 석 달씩 묶어 견줍니다. ±5% 안이면 「–」.</p>' +
      '<div class="col__tablewrap"><table class="col__table" id="colTable"></table></div>' +

      '<div id="colMonth"></div>' +
    "</div>";
  const $ = (id) => document.getElementById(id);

  function render() {
    /* 통계는 다 쓴 달만 — 진행 중인 달(예: 10.01~10.03)은 셈에서 뺍니다 */
    /* ① 모든 카드가 함께 있는 기간만 (한 카드만 있는 앞 달은 적게 보여서)  ② 다 쓴 달만 */
    const cp = C.commonPeriod(tx);
    const cc = C.completeOnly(cp.list);
    const stx = cc.list;
    const byCard = {};
    C.live(stx).forEach((x) => { if (x.a > 0) { const c = x.c || "카드"; byCard[c] = byCard[c] || { n: 0, a: 0 }; byCard[c].n++; byCard[c].a += x.a; } });
    const M = C.byMonth(stx, fix);
    if (!M.length) {
      $("colMeta").textContent = "";
      $("colCards").innerHTML = '<p class="gro__none">아직 읽은 카드 내역이 없습니다 — 「📂 카드내역 읽기」 로 10.장보기/카드내역 폴더를 골라 주세요.</p>';
      ["colLegend", "colChart", "colCat", "colTable", "colMonth"].forEach((id) => { $(id).innerHTML = ""; });
      return;
    }
    const X = C.matrix(stx, fix, 12);
    lastStx = stx;
    const live = C.live(stx);
    $("colMeta").textContent = (meta.file ? meta.file + " · " : "") + live.length + "건 · " +
      live[live.length - 1].d.replace(/-/g, ".") + " ~ " + live[0].d.replace(/-/g, ".") +
      (meta.read ? " · 읽은 때 " + meta.read : "") +
      (Object.keys(byCard).length > 1 ? " · " + Object.entries(byCard).map(([c, v]) => c + " " + v.n + "건 " + C.man(v.a)).join(" + ") : "") +
      (cp.dropped.length ? " · " + cp.from.replace("-", ".") + " 전은 " + cp.dropped.map((q) => q.c + " " + q.n + "건").join(", ") +
        "만 있어 통계에서 뺐습니다 (모든 카드가 있는 달부터)" : "") +
      (cc.cut ? " · " + ymLabel(cc.cut.ym) + "(" + cc.cut.from.slice(5).replace("-", ".") + "~" + cc.cut.to.slice(5).replace("-", ".") +
        ", " + cc.cut.n + "건)은 아직 끝나지 않은 달이라 통계에서 뺐습니다" : "");

    /* 요약 카드 */
    const cur = M[0], prev = M[1];
    const real = (X.partial ? X.totals.slice(0, -1) : X.totals).filter((v) => v > 0);
    const avg = real.reduce((a, b) => a + b, 0) / (real.length || 1);
    const year = M.filter((x) => x.ym.slice(0, 4) === cur.ym.slice(0, 4)).reduce((a, b) => a + b.total, 0);
    const pct = (a, b) => (a && b) ? (a.total - b.total) / (b.total || 1) : null;
    const arrow = (d, b) => d == null ? "" : (d >= 0 ? "▲ " : "▼ ") + Math.abs(Math.round(d * 100)) + "% (" + ymLabel(b.ym) + " 대비)";
    const diff = pct(cur, prev), diff2 = pct(prev, M[2]);
    $("colCards").innerHTML =
      card(cur.ym.slice(0, 4) + "년 " + ymLabel(cur.ym) + " (다 쓴 마지막 달)", C.man(cur.total), cur.n + "건 · " + arrow(diff, prev)) +
      card(prev ? ymLabel(prev.ym) : "지난달", prev ? C.man(prev.total) : "—",
           arrow(diff2, M[2])) +
      card("월평균 (최근 " + real.length + "달)", C.man(avg), "") +
      card(cur.ym.slice(0, 4) + "년 합계", C.man(year), M.filter((x) => x.ym.startsWith(cur.ym.slice(0, 4))).length + "달");

    const V = level === "big" ? C.groupMatrix(X) : X;
    lastX = V;
    drawLegend(V); drawChart(V); drawCat(); drawTable(X); drawMonth();
  }
  const card = (h, v, s) => '<div class="col__card"><span>' + esc(h) + "</span><b>" + esc(v) + "</b><small>" + esc(s) + "</small></div>";

  function drawLegend(X) {
    const sw = '<span class="col__lv"><button type="button" data-lv="big" class="' + (level === "big" ? "on" : "") + '">대분류</button>' +
      '<button type="button" data-lv="small" class="' + (level === "small" ? "on" : "") + '">세부</button></span>';
    $("colLegend").innerHTML = sw +
      '<button type="button" data-k="__total" class="' + (showTotal ? "on" : "") + '"><i style="background:#1c1a19"></i>합계</button>' +
      X.rows.map((r) => '<button type="button" data-k="' + r.k + '" class="' + (hide.indexOf(r.k) < 0 ? "on" : "") + '">' +
        '<i style="background:' + colorOf(r.k) + '"></i>' + esc(nameOf(r.k)) + "</button>").join("");
  }

  /* 선 그래프 — 손으로 그린 SVG (바깥 라이브러리 없이) */
  function drawChart(X) {
    const W = 920, H = 340, L = 56, R = 16, T = 16, B = 34;
    const lines = X.rows.filter((r) => hide.indexOf(r.k) < 0).map((r) => ({ k: r.k, vals: r.vals, color: colorOf(r.k), w: isG(r.k) ? 3 : 2.4 }));
    if (showTotal) lines.unshift({ k: "__total", vals: X.totals, color: "#1c1a19", w: 1.8, dash: "6 5" });
    const max = Math.max(1, ...lines.flatMap((l) => l.vals));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const x = (i) => L + (W - L - R) * (X.months.length === 1 ? 0.5 : i / (X.months.length - 1));
    const y = (v) => T + (H - T - B) * (1 - Math.max(0, v) / top);
    let g = "";
    for (let v = 0; v <= top + 1; v += step) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/>' +
           '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" class="ylab">' + (v / 10000).toLocaleString("ko-KR") + "만</text>";
    }
    X.months.forEach((ym, i) => {
      g += '<text x="' + x(i) + '" y="' + (H - 10) + '" class="xlab">' + ymLabel(ym) + "</text>";
    });
    g += '<line class="guide" id="colGuide" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '" visibility="hidden"/>';
    g += '<rect class="hover" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '"/>';
    lines.forEach((l) => {
      const pts = l.vals.map((v, i) => x(i) + "," + y(v)).join(" ");
      const dim = focus && focus !== l.k ? " dim" : "", on = focus === l.k ? " on" : "";
      g += '<g class="ln' + dim + on + '" data-k="' + l.k + '">' +
        '<polyline class="hit" points="' + pts + '"/>' +
        '<polyline class="draw" points="' + pts + '" fill="none" stroke="' + l.color + '" stroke-width="' + (on ? l.w + 1.6 : l.w) + '"' +
          (l.dash ? ' stroke-dasharray="' + l.dash + '"' : "") + ' stroke-linejoin="round" stroke-linecap="round"/>' +
        l.vals.map((v, i) => v ? '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="' + (on ? 4.5 : 3.2) + '" fill="' + l.color + '"/>' : "").join("") +
        "</g>";
    });
    $("colChart").innerHTML =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="항목별 1년 지출 그래프">' + g + "</svg>" +
      '<div class="col__tip" id="colTip" hidden></div>';

    const svg = $("colChart").querySelector("svg");
    /* 처음 그릴 때 — 선이 왼쪽에서 오른쪽으로 그려집니다 */
    if (animate) {
      animate = false;
      svg.querySelectorAll("polyline.draw").forEach((pl, i) => {
        if (pl.getAttribute("stroke-dasharray")) return;          // 점선(합계)은 그대로
        const len = pl.getTotalLength ? pl.getTotalLength() : 0;
        if (!len) return;
        pl.style.strokeDasharray = len; pl.style.strokeDashoffset = len;
        pl.getBoundingClientRect();
        pl.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.22,.61,.36,1) " + (i * 0.05) + "s";
        pl.style.strokeDashoffset = "0";
        pl.addEventListener("transitionend", () => { pl.style.strokeDasharray = ""; pl.style.transition = ""; }, { once: true });
      });
    }

    /* 마우스를 올리면 — 가까운 달의 세로선과 그 달 금액들 */
    const tip = $("colTip"), guide = $("colGuide");
    const toSvg = (ev) => {
      const m = svg.getScreenCTM && svg.getScreenCTM();
      if (!m) return null;
      const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY;
      return p.matrixTransform(m.inverse());
    };
    const show = (ev) => {
      const p = toSvg(ev); if (!p) return;
      const n = X.months.length;
      const i = Math.max(0, Math.min(n - 1, Math.round((p.x - L) / ((W - L - R) / Math.max(1, n - 1)))));
      guide.setAttribute("x1", x(i)); guide.setAttribute("x2", x(i)); guide.setAttribute("visibility", "visible");
      const rows = lines.filter((l) => !focus || l.k === focus || l.k === "__total")
        .map((l) => ({ k: l.k, v: l.vals[i], c: l.color })).filter((r) => r.v)
        .sort((a, b) => (a.k === "__total" ? -1 : b.k === "__total" ? 1 : b.v - a.v));
      tip.innerHTML = "<b>" + X.months[i].slice(0, 4) + "년 " + ymLabel(X.months[i]) + "</b>" + rows.map((r) =>
        '<span class="' + (r.k === "__total" ? "tot" : "") + '"><i style="background:' + r.c + '"></i>' +
        esc(r.k === "__total" ? "합계" : nameOf(r.k)) + "<em>" + C.won(r.v) + "</em></span>").join("");
      tip.hidden = false;
      const box = $("colChart").getBoundingClientRect();
      const left = ev.clientX - box.left + 14;
      tip.style.left = Math.max(4, Math.min(left, box.width - tip.offsetWidth - 8)) + "px";
      tip.style.top = Math.max(6, ev.clientY - box.top - tip.offsetHeight / 2) + "px";
    };
    const hideTip = () => { tip.hidden = true; guide.setAttribute("visibility", "hidden"); };
    const hover = svg.querySelector("rect.hover");
    hover.addEventListener("mousemove", show);
    hover.addEventListener("mouseleave", hideTip);
    svg.querySelectorAll("g.ln").forEach((gEl) => {
      gEl.addEventListener("mousemove", show);
      gEl.addEventListener("mouseleave", hideTip);
      gEl.addEventListener("click", () => {
        const k = gEl.dataset.k;
        if (k === "__total") return;
        focus = focus === k ? "" : k;
        render();
        if (focus) $("colCat").scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
  }

  /* 항목 상세 — 선을 누르면 */
  function drawCat() {
    const box = $("colCat");
    const X = lastX;
    if (!focus || !X) { box.innerHTML = ""; return; }
    const r = X.rows.find((q) => q.k === focus);
    if (!r) { focus = ""; box.innerHTML = ""; return; }
    const color = colorOf(focus);
    const vals = r.vals;
    const maxV = Math.max(1, ...vals);
    const hi = vals.indexOf(Math.max(...vals));
    const nz = vals.map((v, i) => [v, i]).filter((q) => q[0] > 0);
    const lo = nz.length ? nz.reduce((a, b) => (b[0] < a[0] ? b : a))[1] : -1;
    const total = X.totals.reduce((a, b) => a + b, 0);
    const merch = C.byMerchant(lastStx, fix).filter((m) => inFocus(m.k)).slice(0, 12);
    /* 대분류면 그 안의 세부 항목이 얼마씩인지 */
    const subs = isG(focus) ? (r.subs || []).slice().sort((a, b) => b.sum - a.sum) : [];
    const tcls = r.trend == null ? "" : r.trend > 0.05 ? "up" : r.trend < -0.05 ? "down" : "";
    const trend = r.trend == null ? "—" : (Math.abs(r.trend) < 0.05 ? "비슷함"
      : (r.trend > 0 ? "▲ " : "▼ ") + Math.round(Math.abs(r.trend) * 100) + "%");
    box.innerHTML =
      '<div class="col__cat" style="--c:' + color + '">' +
        '<div class="col__cathead"><i></i><b>' + esc(nameOf(focus)) + "</b>" +
          (isG(focus) ? "<small>" + esc(C.GROUPS.find((G) => G.g === focus.slice(2)).ks.map((k) => C.CAT_NAME[k]).join(" · ")) + "</small>" : "") +
          '<button type="button" class="nbtn nmini" id="colCatX">전체 보기</button></div>' +
        '<div class="col__catnums">' +
          "<div><span>합계</span><b>" + C.man(r.sum) + "</b><small>전체의 " + Math.round(100 * r.sum / (total || 1)) + "%</small></div>" +
          "<div><span>월평균</span><b>" + C.man(r.avg) + "</b><small>" + X.months.length + "달</small></div>" +
          "<div><span>가장 많이 쓴 달</span><b>" + ymLabel(X.months[hi]) + "</b><small>" + C.won(vals[hi]) + "</small></div>" +
          "<div><span>가장 적게 쓴 달</span><b>" + (lo >= 0 ? ymLabel(X.months[lo]) : "—") + "</b><small>" + (lo >= 0 ? C.won(vals[lo]) : "") + "</small></div>" +
          '<div><span>추세</span><b class="' + tcls + '">' + trend + "</b><small>최근 3달 vs 그 앞 3달</small></div>" +
        "</div>" +
        '<div class="col__catbars">' + vals.map((v, i) =>
          '<button type="button" data-ym="' + X.months[i] + '" title="' + esc(ymLabel(X.months[i]) + " · " + C.won(v) + " — 누르면 그 달 상세") + '">' +
          '<em>' + (v ? Math.round(v / 10000) + "만" : "") + "</em>" +
          '<i style="height:' + (100 * v / maxV).toFixed(1) + '%"></i>' +
          "<span>" + ymLabel(X.months[i]) + "</span></button>").join("") + "</div>" +
        (subs.length ? '<h4 class="col__h4">세부 항목</h4><div class="col__bars">' + subs.map((q) =>
          '<div class="col__barrow"><span>' + esc(C.CAT_NAME[q.k]) + '</span><div><i style="width:' + (100 * q.sum / (subs[0].sum || 1)).toFixed(1) +
          "%;background:" + C.CAT_COLOR[q.k] + '"></i></div><b>' + C.man(q.sum) + "</b><small>" + Math.round(100 * q.sum / (r.sum || 1)) + "%</small></div>").join("") + "</div>" : "") +
        (!isG(focus) ? '<p class="col__desc">' + esc(C.DESC[focus] || "") + "</p>" : "") +
        '<h4 class="col__h4">' + esc(nameOf(focus)) + "에서 많이 쓴 곳</h4>" +
        (merch.length ? '<ol class="col__merch">' + merch.map((m) =>
          "<li><span>" + esc(m.m) + "</span><small>" + (isG(focus) ? esc(C.CAT_NAME[m.k]) + " · " : "") + m.n + "번</small><b>" + C.won(m.a) + "</b></li>").join("") + "</ol>"
          : '<p class="gro__none">—</p>') +
      "</div>";
    $("colCatX").addEventListener("click", () => { focus = ""; render(); });
  }
  function niceStep(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  function drawTable(X) {
    const trend = (t) => t == null ? "" : (Math.abs(t) < 0.05 ? '<span class="tr flat">–</span>'
      : '<span class="tr ' + (t > 0 ? "up" : "down") + '">' + (t > 0 ? "▲" : "▼") + Math.round(Math.abs(t) * 100) + "%</span>");
    const cell = (v) => v ? Math.round(v / 1000).toLocaleString("ko-KR") : '<span class="z">·</span>';
    const GX = C.groupMatrix(X);
    /* 세부 항목마다 이 기간에 많이 쓴 가게 — 예시로 열 곳까지 (이 브라우저 안에서만 보입니다) */
    const merch = C.byMerchant(lastStx, fix);
    const ex = (k) => merch.filter((m) => m.k === k).slice(0, 10).map((m) => m.m.replace(/\s*\(?주식회사\)?\s*|\(주\)\s*|\(유\)\s*/g, " ").trim());
    /* 왼쪽 칸 — 이름 + 들어가는 것 + 예시 (작은 글씨) */
    const left = (r, kind) => {
      let sub = "";
      if (kind === "sub" || (kind === "big" && r.subs.length === 1)) {
        const k = kind === "sub" ? r.k : r.subs[0].k;
        const e = ex(k);
        sub = '<small class="col__d">' + esc(C.DESC[k] || "") + "</small>" +
              (e.length ? '<small class="col__ex">예: ' + e.map(esc).join(" · ") + "</small>" : "");
      } else if (kind === "big") {
        sub = '<small class="col__d">' + esc(r.subs.slice().sort((a, b) => b.sum - a.sum).map((q) => C.CAT_NAME[q.k]).join(" · ")) + "</small>";
      }
      return '<th><button type="button" class="col__rowk" data-fk="' + r.k + '" title="눌러서 그래프에서 이 선만 보기">' +
        '<i style="background:' + colorOf(r.k) + '"></i>' + esc(nameOf(r.k)) + "</button>" + sub + "</th>";
    };
    const row = (r, kind) => '<tr class="' + kind + (focus === r.k ? " on" : "") + '">' + left(r, kind) +
      r.vals.map((v) => "<td>" + cell(v) + "</td>").join("") +
      "<td>" + cell(r.avg) + "</td><td>" + trend(r.trend) + "</td></tr>";
    $("colTable").innerHTML =
      '<thead><tr><th>항목 <small>— 들어가는 것 · 예시</small></th>' + X.months.map((ym) =>
        '<th><button type="button" data-ym="' + ym + '" class="' + (sel === ym ? "on" : "") + '">' + ymLabel(ym) + "</button></th>").join("") +
      '<th>월평균</th><th title="최근 3달 한 달 평균 vs 그 앞 3달 한 달 평균">추세</th></tr></thead><tbody>' +
      GX.rows.map((G) => row(G, "big") +
        (G.subs.length > 1 ? G.subs.slice().sort((a, b) => b.sum - a.sum).map((q) => row(q, "sub")).join("") : "")).join("") +
      '</tbody><tfoot><tr><th>합계</th>' + X.totals.map((v) => "<td>" + cell(v) + "</td>").join("") +
      "<td>" + cell(X.totals.filter((v) => v).reduce((a, b) => a + b, 0) / (X.totals.filter((v) => v).length || 1)) + "</td><td></td></tr></tfoot>";
  }

  /* 달 하나 자세히 — 항목 막대 · 많이 쓴 곳 · 내역 (갈래를 바꾸면 그 가맹점은 앞으로도 그 갈래) */
  function drawMonth() {
    const box = $("colMonth");
    if (!sel) { box.innerHTML = ""; return; }
    const list = C.completeOnly(C.commonPeriod(tx).list).list.filter((x) => x.d.startsWith(sel));
    const total = list.reduce((a, b) => a + b.a, 0);
    const cats = {};
    list.forEach((x) => { const k = C.category(x.m, fix); cats[k] = (cats[k] || 0) + x.a; });
    const ranked = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const merch = C.byMerchant(list, fix).slice(0, 12);
    box.innerHTML =
      '<div class="col__month"><h3 class="gro__h">' + sel.slice(0, 4) + "년 " + ymLabel(sel) + " — " + C.won(total) + " · " + list.length + "건" +
        ' <button type="button" class="nbtn nmini" id="colClose">닫기</button></h3>' +
      '<div class="col__bars">' + ranked.map(([k, v]) =>
        '<div class="col__barrow"><span>' + esc(C.CAT_NAME[k]) + '</span><div><i style="width:' + (100 * v / (ranked[0][1] || 1)).toFixed(1) +
        "%;background:" + C.CAT_COLOR[k] + '"></i></div><b>' + C.won(v) + "</b><small>" + Math.round(100 * v / (total || 1)) + "%</small></div>").join("") + "</div>" +
      '<h4 class="col__h4">많이 쓴 곳</h4><ol class="col__merch">' + merch.map((m) =>
        "<li><span>" + esc(m.m) + "</span><small>" + esc(C.CAT_NAME[m.k]) + " · " + m.n + "번</small><b>" + C.won(m.a) + "</b></li>").join("") + "</ol>" +
      '<details class="col__tx"><summary>이 달 내역 ' + list.length + "건 — 갈래가 틀리면 고르개로 바꿔 주세요 (같은 가맹점은 앞으로도 그 갈래)</summary>" +
      "<table>" + list.map((x) => "<tr><td>" + esc(x.d.slice(5).replace("-", ".")) + " " + esc(x.t) + "</td><td>" + esc(x.m) + (x.c ? ' <small class="col__card">' + esc(x.c) + "</small>" : "") + "</td><td class=\"n\">" +
        C.won(x.a) + (x.x === 2 ? " <small>(부분취소)</small>" : "") + '</td><td><select data-m="' + esc(x.m) + '">' +
        C.CATS.map((c) => '<option value="' + c.k + '"' + (c.k === C.category(x.m, fix) ? " selected" : "") + ">" + esc(c.name) + "</option>").join("") +
        "</select></td></tr>").join("") + "</table></details></div>";
  }

  mount.addEventListener("click", (e) => {
    const rk = e.target.closest("button.col__rowk");
    if (rk) {
      const k = rk.dataset.fk;
      const want = isG(k) ? "big" : "small";
      if (level !== want) { level = want; put("skyish-cost-level", level); }
      const hi = hide.indexOf(k); if (hi >= 0) { hide.splice(hi, 1); put(K_HIDE, hide); }   // 꺼 둔 선이면 다시 켭니다
      focus = focus === k ? "" : k;
      render();
      $("colChart").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const lv = e.target.closest("#colLegend button[data-lv]");
    if (lv) { level = lv.dataset.lv; put("skyish-cost-level", level); focus = ""; render(); return; }
    const lg = e.target.closest("#colLegend button[data-k]");
    if (lg) {
      const k = lg.dataset.k;
      if (k === "__total") showTotal = !showTotal;
      else { const i = hide.indexOf(k); if (i >= 0) hide.splice(i, 1); else { hide.push(k); if (focus === k) focus = ""; } put(K_HIDE, hide); }
      render(); return;
    }
    const mb = e.target.closest("button[data-ym]");
    if (mb) { sel = sel === mb.dataset.ym ? "" : mb.dataset.ym; render();
      if (sel) $("colMonth").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (e.target.closest("#colClose")) { sel = ""; render(); }
  });
  mount.addEventListener("change", (e) => {
    const s = e.target.closest("select[data-m]");
    if (!s) return;
    fix[s.dataset.m] = s.value; put(K_FIX, fix); render();
  });

  /* ── 카드내역 읽기 ── */
  async function walk(dir, out, depth) {
    for await (const h of dir.values()) {
      if (h.kind === "directory") { if (depth < 2) await walk(h, out, depth + 1); continue; }
      if ((/\.(xlsx|xls|csv)$/i.test(h.name) && !/^~\$/.test(h.name)) || /가맹점분류\.json$/.test(h.name)) out.push(h);
    }
  }
  $("colRead").addEventListener("click", async (ev) => {
    if (typeof window.showDirectoryPicker !== "function") { alert("컴퓨터에서 쓰는 기능입니다."); return; }
    const got = await FK.pick("cost", { mode: "read", id: "skyish-cost", again: !!(ev && ev.shiftKey) });
    const dir = got && got.handle;
    if (!dir) return;
    const btn = $("colRead"); btn.disabled = true; btn.textContent = "읽는 중…";
    try {
      const files = []; await walk(dir, files, 0);
      if (!files.length) { alert("이 폴더에 엑셀(xlsx)이 없습니다 — 10.장보기/카드내역 폴더를 골라 주세요."); return; }
      /* 가게 이름 규칙 (비공개 파일) */
      const pj = files.find((h) => /가맹점분류\.json$/.test(h.name));
      if (pj) {
        try { const map = JSON.parse(await (await pj.getFile()).text()); put(K_PRIV, map); C.setPrivate(map); } catch (e) {}
      }
      const X = await import(/* @vite-ignore */ XLSX_LIB);
      let add = [], names = [];
      for (const h of files.filter((f) => !/\.json$/.test(f.name))) {
        const wb = X.read(await (await h.getFile()).arrayBuffer(), { type: "array", cellDates: false });
        let n = 0;
        wb.SheetNames.forEach((sn) => {
          const rows = X.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: "" });
          const got2 = C.fromSheet(rows, C.cardOf(h.name));
          n += got2.length; add = add.concat(got2);
        });
        if (n) names.push(h.name);
      }
      const before = tx.length;
      tx = C.merge(tx, add);
      put(K_TX, tx);
      const d = new Date();
      meta = { file: names.join(", "), read: (d.getMonth() + 1) + "." + d.getDate() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") };
      put(K_META, meta);
      render();
      alert("읽었습니다 — " + add.length + "건 (새로 더한 것 " + (tx.length - before) + "건)." +
            "\n전체취소된 결제는 합계에서 뺍니다.");
    } catch (err) {
      alert("읽지 못했습니다 — " + (err && err.message));
    } finally { btn.disabled = false; btn.textContent = "📂 카드내역 읽기"; }
  });

  render();
  return true;
}
