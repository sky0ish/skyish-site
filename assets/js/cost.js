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
import * as C from "./cost-parse.js?v=202610032300";
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

  mount.innerHTML =
    '<div class="col">' +
      '<div class="col__bar">' +
        '<button type="button" class="nbtn nbtn--go" id="colRead" title="10.장보기/카드내역 폴더의 엑셀을 읽습니다 (Shift 를 누른 채 누르면 폴더를 새로 고릅니다)">📂 카드내역 읽기</button>' +
        '<span class="col__meta" id="colMeta"></span>' +
      "</div>" +
      '<p class="col__note">카드 내역은 <b>이 컴퓨터 브라우저에만</b> 저장됩니다 — 서버나 GitHub 로 올라가지 않습니다. 카드번호·승인번호는 읽지 않습니다.</p>' +
      '<div class="col__cards" id="colCards"></div>' +
      '<h3 class="gro__h">항목별 1년 흐름 <small>— 선을 눌러 끄고 켤 수 있습니다</small></h3>' +
      '<div class="col__legend" id="colLegend"></div>' +
      '<div class="col__chart" id="colChart"></div>' +
      '<h3 class="gro__h">매달 항목별 <small>— 단위 천원 · 달을 누르면 그 달을 자세히 · ▲▼ 최근 3달이 그 앞 3달보다</small></h3>' +
      '<div class="col__tablewrap"><table class="col__table" id="colTable"></table></div>' +
      '<div id="colMonth"></div>' +
    "</div>";
  const $ = (id) => document.getElementById(id);

  function render() {
    /* 통계는 다 쓴 달만 — 진행 중인 달(예: 10.01~10.03)은 셈에서 뺍니다 */
    const cc = C.completeOnly(tx);
    const stx = cc.list;
    const M = C.byMonth(stx, fix);
    if (!M.length) {
      $("colMeta").textContent = "";
      $("colCards").innerHTML = '<p class="gro__none">아직 읽은 카드 내역이 없습니다 — 「📂 카드내역 읽기」 로 10.장보기/카드내역 폴더를 골라 주세요.</p>';
      ["colLegend", "colChart", "colTable", "colMonth"].forEach((id) => { $(id).innerHTML = ""; });
      return;
    }
    const X = C.matrix(stx, fix, 12);
    const live = C.live(stx);
    $("colMeta").textContent = (meta.file ? meta.file + " · " : "") + live.length + "건 · " +
      live[live.length - 1].d.replace(/-/g, ".") + " ~ " + live[0].d.replace(/-/g, ".") +
      (meta.read ? " · 읽은 때 " + meta.read : "") +
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

    drawLegend(X); drawChart(X); drawTable(X); drawMonth();
  }
  const card = (h, v, s) => '<div class="col__card"><span>' + esc(h) + "</span><b>" + esc(v) + "</b><small>" + esc(s) + "</small></div>";

  function drawLegend(X) {
    $("colLegend").innerHTML =
      '<button type="button" data-k="__total" class="' + (showTotal ? "on" : "") + '"><i style="background:#1c1a19"></i>합계</button>' +
      X.rows.map((r) => '<button type="button" data-k="' + r.k + '" class="' + (hide.indexOf(r.k) < 0 ? "on" : "") + '">' +
        '<i style="background:' + C.CAT_COLOR[r.k] + '"></i>' + esc(C.CAT_NAME[r.k]) + "</button>").join("");
  }

  /* 선 그래프 — 손으로 그린 SVG (바깥 라이브러리 없이) */
  function drawChart(X) {
    const W = 920, H = 340, L = 56, R = 16, T = 16, B = 34;
    const lines = X.rows.filter((r) => hide.indexOf(r.k) < 0).map((r) => ({ k: r.k, vals: r.vals, color: C.CAT_COLOR[r.k], w: 2.2 }));
    if (showTotal) lines.unshift({ k: "__total", vals: X.totals, color: "#1c1a19", w: 1.6, dash: "5 4" });
    const max = Math.max(1, ...lines.flatMap((l) => l.vals));
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const x = (i) => L + (W - L - R) * (X.months.length === 1 ? 0.5 : i / (X.months.length - 1));
    const y = (v) => T + (H - T - B) * (1 - v / top);
    let g = "";
    for (let v = 0; v <= top + 1; v += step) {
      g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="grid"/>' +
           '<text x="' + (L - 6) + '" y="' + (y(v) + 4) + '" class="ylab">' + (v / 10000).toLocaleString("ko-KR") + "만</text>";
    }
    X.months.forEach((ym, i) => {
      const pt = X.partial && i === X.months.length - 1;
      g += '<text x="' + x(i) + '" y="' + (H - 10) + '" class="xlab">' + ymLabel(ym) + (pt ? "*" : "") + "</text>";
    });
    lines.forEach((l) => {
      const pts = l.vals.map((v, i) => x(i) + "," + y(v)).join(" ");
      g += '<polyline points="' + pts + '" fill="none" stroke="' + l.color + '" stroke-width="' + l.w + '"' +
           (l.dash ? ' stroke-dasharray="' + l.dash + '"' : "") + ' stroke-linejoin="round" stroke-linecap="round"/>';
      l.vals.forEach((v, i) => {
        if (!v) return;
        g += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3" fill="' + l.color + '"><title>' +
          esc((l.k === "__total" ? "합계" : C.CAT_NAME[l.k]) + " · " + ymLabel(X.months[i]) + " · " + C.won(v)) + "</title></circle>";
      });
    });
    $("colChart").innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="항목별 1년 지출 그래프">' + g + "</svg>" +
      (X.partial ? '<p class="col__foot">* 진행 중인 달 — 아직 다 쓰지 않은 달이라 낮게 보입니다. 추세(▲▼)에서는 뺍니다.</p>' : "");
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
    $("colTable").innerHTML =
      "<thead><tr><th>항목</th>" + X.months.map((ym) =>
        '<th><button type="button" data-ym="' + ym + '" class="' + (sel === ym ? "on" : "") + '">' + ymLabel(ym) +
        (X.partial && ym === X.months[X.months.length - 1] ? "*" : "") + "</button></th>").join("") +
      "<th>월평균</th><th>추세</th></tr></thead><tbody>" +
      X.rows.map((r) => "<tr><th><i style=\"background:" + C.CAT_COLOR[r.k] + "\"></i>" + esc(C.CAT_NAME[r.k]) + "</th>" +
        r.vals.map((v) => "<td>" + cell(v) + "</td>").join("") +
        "<td>" + cell(r.avg) + "</td><td>" + trend(r.trend) + "</td></tr>").join("") +
      '</tbody><tfoot><tr><th>합계</th>' + X.totals.map((v) => "<td>" + cell(v) + "</td>").join("") +
      "<td>" + cell(X.totals.filter((v) => v).reduce((a, b) => a + b, 0) / (X.totals.filter((v) => v).length || 1)) + "</td><td></td></tr></tfoot>";
  }

  /* 달 하나 자세히 — 항목 막대 · 많이 쓴 곳 · 내역 (갈래를 바꾸면 그 가맹점은 앞으로도 그 갈래) */
  function drawMonth() {
    const box = $("colMonth");
    if (!sel) { box.innerHTML = ""; return; }
    const list = C.completeOnly(tx).list.filter((x) => x.d.startsWith(sel));
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
      "<table>" + list.map((x) => "<tr><td>" + esc(x.d.slice(5).replace("-", ".")) + " " + esc(x.t) + "</td><td>" + esc(x.m) + "</td><td class=\"n\">" +
        C.won(x.a) + (x.x === 2 ? " <small>(부분취소)</small>" : "") + '</td><td><select data-m="' + esc(x.m) + '">' +
        C.CATS.map((c) => '<option value="' + c.k + '"' + (c.k === C.category(x.m, fix) ? " selected" : "") + ">" + esc(c.name) + "</option>").join("") +
        "</select></td></tr>").join("") + "</table></details></div>";
  }

  mount.addEventListener("click", (e) => {
    const lg = e.target.closest("#colLegend button");
    if (lg) {
      const k = lg.dataset.k;
      if (k === "__total") showTotal = !showTotal;
      else { const i = hide.indexOf(k); if (i >= 0) hide.splice(i, 1); else hide.push(k); put(K_HIDE, hide); }
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
          const got2 = C.fromSheet(rows);
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
