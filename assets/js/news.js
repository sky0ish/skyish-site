// ─── Contact 「최신뉴스」 ───────────────────────────────────
//
//   AI · 건축 · 도시 · 부동산 네 갈래.
//   글 목록은 tools/news/collect.py 가 날마다 모아 assets/data/news/<갈래>.json 에
//   담아 둡니다 (바깥 사이트는 브라우저에서 직접 부를 수 없어서 — CORS).
//   여기서는 그 파일을 읽어 갈래·출처·낱말로 걸러 보여 줄 뿐입니다. 누구나 봅니다.

const CATS = [
  { k: "ai",     name: "AI",     note: "GeekNews 의 AI 관련 글 · 테크월드뉴스 AI · 최근 2년" },
  { k: "arch",   name: "건축",   note: "대한건축사협회 건축뉴스 · ArchDaily (프리츠커상 수상자 · 세계적 건축가·사무소 작품만) · 최근 1년" },
  { k: "city",   name: "도시",   note: "한국도시정비신문 · 국토연구원 세계도시사례 · 도시계획학회 10대 뉴스 · Planetizen" },
  { k: "estate", name: "부동산", note: "네이버 부동산 뉴스 · 최근 1년" },
];
/* 출처 배지 — 「어느 매체 기사인지」 한눈에. 이름은 짧게, 색은 출처마다 */
const BADGE = {
  "GeekNews":               ["GeekNews",     "#e8f5ec", "#1f7a43"],
  "테크월드뉴스 AI":          ["테크월드",      "#e7effc", "#2353a8"],
  "대한건축사협회 건축뉴스":   ["건축사협회",    "#eef0f7", "#223a7a"],
  "ArchDaily":              ["ArchDaily",    "#efefef", "#333333"],
  "한국도시정비신문":          ["도시정비신문",  "#fdf0e4", "#b35a12"],
  "국토연구원 세계도시사례":   ["국토연구원",    "#e6f4f2", "#2f6a62"],
  "도시계획학회 10대 뉴스":    ["도시계획학회",  "#f3ecf7", "#7a4b93"],
  "Planetizen":                ["Planetizen",    "#eaf1fb", "#2d5d9f"],
  "네이버 부동산 뉴스":        ["네이버뉴스",    "#e7f8ec", "#03a94f"],
};
const badge = (k) => {
  const b = BADGE[k] || [k || "출처", "#f1efec", "#756464"];
  return `<span class="nws__badge" style="background:${b[1]};color:${b[2]}">${esc(b[0])}</span>`;
};
/* 「ArchDaily · Houses」 처럼 출처 뒤에 붙은 갈래만 떼어 냅니다 (출처 이름은 배지가 말해 줍니다) */
const subOf = (it) => {
  const parts = String(it.src || "").split(" · ");
  return parts.length > 1 ? parts.slice(1).join(" · ") : "";
};

/* 「전체」 — 네 갈래를 한 게시판에 날짜 차례로 */
const ALL = { k: "all", name: "전체", note: "AI · 건축 · 도시 · 부동산 — 모든 갈래의 글을 날짜 차례로" };
const TABS = [ALL].concat(CATS);
const CAT_NAME = Object.fromEntries(CATS.map((c) => [c.k, c.name]));

const PAGE = 40;                     // 한 번에 보여 줄 글 수 (더 보기로 늘립니다)
const PREF = "skyish-news-cat";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 같은 화면 안에서 한 번 받은 갈래는 다시 받지 않습니다 */
const cache = {};
const stamp = () => Math.floor(Date.now() / 36e5);
async function load(k) {
  if (cache[k]) return cache[k];
  const r = await fetch("assets/data/news/" + k + ".json?v=" + stamp(), { cache: "no-cache" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return (cache[k] = await r.json());
}
/** 지난 글(제목만)은 「더 보기」 끝에 다다르거나 찾기·출처 거르기를 할 때만 읽습니다 */
async function loadOld(k) {
  const doc = await load(k);
  if (doc._old || !doc.more) return doc;
  doc._old = true;
  try {
    const r = await fetch("assets/data/news/" + k + "-old.json?v=" + stamp(), { cache: "no-cache" });
    if (r.ok) doc.items = doc.items.concat((await r.json()).items || []);
  } catch (e) { doc._old = false; }
  return doc;
}

/** 「전체」 게시판의 자료 — 네 갈래를 합칩니다 (old = 지난 글까지) */
async function loadAll(old) {
  const docs = await Promise.all(CATS.map((c) => (old ? loadOld(c.k) : load(c.k)).catch(() => null)));
  const items = [], sources = [];
  let total = 0, more = false, updated = "";
  docs.forEach((d, i) => {
    if (!d) return;
    const k = CATS[i].k;
    (d.items || []).forEach((it) => items.push(Object.assign({ _c: k }, it)));
    const n = d.total || (d.items || []).length;
    total += n;
    more = more || (!!d.more && !d._old);
    if ((d.updated || "") > updated) updated = d.updated;
    sources.push({ name: k, label: CAT_NAME[k], count: n, ok: !(d.sources || []).some((s) => !s.ok),
                   bad: (d.sources || []).filter((s) => !s.ok) });
  });
  items.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  return { items, sources, total, more, _old: !!old, updated, all: true };
}
/** 화면을 다시 읽게 — 「최신으로」가 끝나면 */
function forget() { Object.keys(cache).forEach((k) => delete cache[k]); }

/** 낱말 거르기 — 띄어 쓴 낱말을 모두 품은 글만 */
export function match(it, q) {
  const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = (it.t + " " + (it.s || "") + " " + it.src).toLowerCase();
  return words.every((w) => hay.indexOf(w) >= 0);
}

export function initNews(id = "newsapp") {
  const box = document.getElementById(id);
  if (!box) return false;

  let cat = "all";
  try { const c = localStorage.getItem(PREF); if (TABS.some((x) => x.k === c)) cat = c; } catch (e) {}
  let src = "", q = "", shown = PAGE;

  box.innerHTML =
    '<div class="nws__cats" role="tablist">' +
      TABS.map((c) => `<button type="button" role="tab" data-c="${c.k}">${c.name}</button>`).join("") +
      '<span class="nws__sp"></span>' +
      '<button type="button" class="nws__go" id="nwsGo" hidden title="모든 갈래를 수집 로직대로 지금 다시 모읍니다">⟳ 모든 갈래 최신으로</button>' +
    "</div>" +
    '<p class="nws__run" id="nwsRun" hidden></p>' +
    '<div class="nws__bar">' +
      '<div class="nws__srcs" id="nwsSrcs"></div>' +
      '<input type="search" class="nws__q" id="nwsQ" placeholder="낱말로 찾기" aria-label="뉴스 낱말 찾기">' +
    "</div>" +
    '<p class="nws__note" id="nwsNote"></p>' +
    '<ol class="nws__list" id="nwsList"><li class="nws__empty">불러오는 중…</li></ol>' +
    '<div class="nws__more"><button type="button" id="nwsMore" hidden>더 보기</button></div>';

  const list = box.querySelector("#nwsList");
  const srcBox = box.querySelector("#nwsSrcs");
  const note = box.querySelector("#nwsNote");
  const more = box.querySelector("#nwsMore");

  async function draw() {
    box.querySelectorAll(".nws__cats button").forEach((b) =>
      b.classList.toggle("on", b.dataset.c === cat));
    const meta = TABS.find((c) => c.k === cat);
    let doc;
    try {
      if (cat === "all") {
        doc = await loadAll(false);
        if (doc.more && (q || src || shown >= doc.items.length)) doc = await loadAll(true);
        if (!doc.items.length) throw new Error("없음");
      } else {
        doc = await load(cat);
        /* 찾기·출처 거르기·끝까지 보기에는 지난 글까지 */
        if (doc.more && (q || src || shown >= (doc.items || []).length)) doc = await loadOld(cat);
      }
    }
    catch (e) {
      list.innerHTML = '<li class="nws__empty">아직 모아 둔 뉴스가 없습니다.</li>';
      note.textContent = meta.note;
      srcBox.innerHTML = ""; more.hidden = true;
      return;
    }
    const items = doc.items || [];
    const srcs = doc.sources || [];
    srcBox.innerHTML =
      `<button type="button" data-s="" class="${src ? "" : "on"}">전체 <b>${doc.total || items.length}</b></button>` +
      srcs.map((s) =>
        `<button type="button" data-s="${esc(s.name)}" class="${src === s.name ? "on" : ""}${s.ok ? "" : " off"}"` +
        ` title="${esc(s.ok ? s.url : "지난번에 못 받았습니다 — " + (s.why || ""))}">` +
        `${esc(s.label || s.name)} <b>${s.count || 0}</b></button>`).join("");

    const off = doc.all ? [].concat(...srcs.map((s) => s.bad || [])) : srcs.filter((s) => !s.ok);
    note.innerHTML = esc(meta.note) +
      (doc.updated ? ` · <span class="nws__upd">${esc(doc.updated)} 기준</span>` : "") +
      (off.length ? `<br><span class="nws__warn">⚠ ${off.map((s) => esc(s.name) + " — " + esc(s.why || "못 받음")).join(" / ")}</span>` : "");

    const pick = items.filter((it) => (!src || (doc.all ? it._c === src : it.k === src)) && match(it, q));
    if (!pick.length) {
      list.innerHTML = '<li class="nws__empty">' + (items.length ? "맞는 글이 없습니다." : "아직 모아 둔 뉴스가 없습니다.") + "</li>";
      more.hidden = true;
      return;
    }
    let lastMonth = "";
    list.innerHTML = pick.slice(0, shown).map((it) => {
      const mon = it.d.slice(0, 7);
      const head = mon !== lastMonth ? `<li class="nws__mon">${mon.replace("-", ". ")}</li>` : "";
      lastMonth = mon;
      return head +
        `<li class="nws__it"><span class="nws__d">${esc(it.d.slice(5).replace("-", "."))}</span>` +
        `<a href="${esc(it.u)}" target="_blank" rel="noopener">${esc(it.t)}` +
        (subOf(it) ? ` <span class="nws__sub">${esc(subOf(it))}</span>` : "") + `</a>` +
        (doc.all ? `<span class="nws__cat nws__cat--${esc(it._c)}">${esc(CAT_NAME[it._c] || "")}</span>` : "") +
        badge(it.k) +
        (it.s ? `<span class="nws__s">${esc(it.s)}</span>` : "") + "</li>";
    }).join("");
    const left = (doc.more && !doc._old && !q && !src) ? (doc.total || 0) - shown : pick.length - shown;
    more.hidden = left <= 0;
    more.textContent = "더 보기 (" + left + "건 남음)";
  }

  box.querySelector(".nws__cats").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-c]");
    if (!b) return;
    cat = b.dataset.c; src = ""; shown = PAGE;
    try { localStorage.setItem(PREF, cat); } catch (err) {}
    draw();
  });
  srcBox.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-s]");
    if (!b) return;
    src = b.dataset.s; shown = PAGE; draw();
  });
  let t = 0;
  box.querySelector("#nwsQ").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => { q = e.target.value; shown = PAGE; draw(); }, 150);
  });
  more.addEventListener("click", () => { shown += PAGE * 2; draw(); });

  wireRefresh(box, () => { forget(); draw(); });
  draw();
  return true;
}


/* ── 「⟳ 모든 갈래 최신으로」 ──
   정적 홈피는 수집 프로그램을 직접 돌릴 수 없어, 서버 함수(news-refresh)가 GitHub 의 news 워크플로
   (매일 아침 도는 것과 같은 수집 로직 — tools/news/collect.py)를 지금 돌리게 합니다.
   수집(약 2~5분) → 결과 올림 → 홈피 다시 배포(약 1분) → 새 파일이 보이면 화면을 다시 그립니다. */
async function wireRefresh(box, redraw) {
  const go = box.querySelector("#nwsGo"), run = box.querySelector("#nwsRun");
  let auth;
  try {
    auth = await import("../../auth/auth.js");
    const p = await auth.myProfile();
    if (!p || !p.is_admin) return;               // 관리자에게만 단추가 보입니다
  } catch (e) { return; }
  go.hidden = false;
  const say = (t, cls) => { run.hidden = !t; run.className = "nws__run" + (cls ? " " + cls : ""); run.innerHTML = t || ""; };
  const call = async (action) => {
    const { data } = await auth.sb.auth.getSession();
    const jwt = data && data.session && data.session.access_token;
    if (!jwt) throw new Error("로그인이 필요합니다");
    const { SUPABASE_URL, SUPABASE_KEY } = await import("../../auth/config.js");
    const r = await fetch(SUPABASE_URL + "/functions/v1/news-refresh", {
      method: "POST",
      headers: { Authorization: "Bearer " + jwt, apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status) + (r.status === 404 ? " — 서버 함수 news-refresh 를 아직 올리지 않았습니다" : ""));
    return j;
  };
  const latest = async () => {                     // 지금 배포된 뉴스 파일들의 「기준 시각」
    const ts = await Promise.all(CATS.map((c) =>
      fetch("assets/data/news/" + c.k + ".json?t=" + Date.now(), { cache: "no-store" })
        .then((r) => r.json()).then((d) => d.updated || "").catch(() => "")));
    return ts.sort().pop() || "";
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  go.addEventListener("click", async () => {
    go.disabled = true;
    const t0 = Date.now(), before = await latest();
    try {
      say("수집을 시작합니다…");
      const st = await call("run");
      say(st.already ? "이미 수집 중입니다 — 끝나기를 기다립니다…" : "수집 중… (AI · 건축 · 도시 · 부동산 — 보통 2~5분)");
      /* ① 워크플로가 끝나기를 기다립니다 (최대 15분) */
      let done = null;
      for (let i = 0; i < 90 && !done; i++) {
        await wait(10000);
        const s = await call("status").catch(() => null);
        if (!s || s.none) continue;
        const mine = Date.parse(s.created) >= t0 - 60000 || st.already;
        if (mine && s.status === "completed") done = s;
        else if (mine) say(`수집 중… <small>${Math.round((Date.now() - t0) / 1000)}초 · ${esc(s.status === "queued" ? "차례를 기다리는 중" : "모으는 중")}</small>` +
                           ` <a href="${esc(s.url)}" target="_blank" rel="noopener">진행 보기 ↗</a>`);
      }
      if (!done) throw new Error("15분이 지나도 끝나지 않았습니다 — GitHub Actions 에서 확인해 주세요");
      if (done.conclusion !== "success")
        throw new Error(`수집이 실패했습니다 (${done.conclusion}) — <a href="${esc(done.url)}" target="_blank" rel="noopener">기록 보기 ↗</a>`);
      /* ② 홈피에 새 파일이 배포되기를 기다립니다 (최대 5분) */
      say("수집 완료 — 홈피에 반영되기를 기다립니다…");
      let now = before;
      for (let i = 0; i < 30 && now === before; i++) { await wait(10000); now = await latest(); }
      redraw();
      say(now !== before ? `✓ 모든 갈래를 최신으로 바꿨습니다 · ${esc(now)} 기준`
                         : "✓ 수집은 끝났지만 새 글이 없었습니다 (또는 배포가 늦어지고 있습니다 — 잠시 뒤 새로고침)", "ok");
    } catch (e) {
      say("⚠ " + (e && e.message ? e.message : e), "bad");
    } finally {
      go.disabled = false;
    }
  });
}
