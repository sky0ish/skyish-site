// ─── Contact 「최신뉴스」 ───────────────────────────────────
//
//   AI · 건축 · 도시 · 부동산 네 갈래.
//   글 목록은 tools/news/collect.py 가 날마다 모아 assets/data/news/<갈래>.json 에
//   담아 둡니다 (바깥 사이트는 브라우저에서 직접 부를 수 없어서 — CORS).
//   여기서는 그 파일을 읽어 갈래·출처·낱말로 걸러 보여 줄 뿐입니다. 누구나 봅니다.

const CATS = [
  { k: "ai",     name: "AI",     note: "GeekNews 의 AI 관련 글 · 테크월드뉴스 AI · 최근 2년" },
  { k: "arch",   name: "건축",   note: "대한건축사협회 건축뉴스 · ArchDaily · 최근 1년" },
  { k: "city",   name: "도시",   note: "한국도시정비신문 · 국토연구원 세계도시사례 · 도시계획학회 10대 뉴스" },
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

  let cat = "ai";
  try { const c = localStorage.getItem(PREF); if (CATS.some((x) => x.k === c)) cat = c; } catch (e) {}
  let src = "", q = "", shown = PAGE;

  box.innerHTML =
    '<div class="nws__cats" role="tablist">' +
      CATS.map((c) => `<button type="button" role="tab" data-c="${c.k}">${c.name}</button>`).join("") +
    "</div>" +
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
    const meta = CATS.find((c) => c.k === cat);
    let doc;
    try {
      doc = await load(cat);
      /* 찾기·출처 거르기·끝까지 보기에는 지난 글까지 */
      if (doc.more && (q || src || shown >= (doc.items || []).length)) doc = await loadOld(cat);
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
        `${esc(s.name)} <b>${s.count || 0}</b></button>`).join("");

    const off = srcs.filter((s) => !s.ok);
    note.innerHTML = esc(meta.note) +
      (doc.updated ? ` · <span class="nws__upd">${esc(doc.updated)} 기준</span>` : "") +
      (off.length ? `<br><span class="nws__warn">⚠ ${off.map((s) => esc(s.name) + " — " + esc(s.why || "못 받음")).join(" / ")}</span>` : "");

    const pick = items.filter((it) => (!src || it.k === src) && match(it, q));
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

  draw();
  return true;
}
