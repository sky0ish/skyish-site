// ─── Contact 「최신뉴스」 ───────────────────────────────────
//
//   AI · 건축 · 도시 · 부동산 네 갈래.
//   글 목록은 tools/news/collect.py 가 날마다 모아 assets/data/news/<갈래>.json 에
//   담아 둡니다 (바깥 사이트는 브라우저에서 직접 부를 수 없어서 — CORS).
//   여기서는 그 파일을 읽어 갈래·출처·낱말로 걸러 보여 줄 뿐입니다. 누구나 봅니다.

const CATS = [
  { k: "ai",     name: "AI",     note: "GeekNews 의 AI 관련 글 · 최근 2년" },
  { k: "arch",   name: "건축",   note: "대한건축사협회 건축뉴스 · ArchDaily · 최근 1년" },
  { k: "city",   name: "도시",   note: "한국도시정비신문 · 국토연구원 세계도시사례 · 도시계획학회 10대 뉴스" },
  { k: "estate", name: "부동산", note: "네이버 부동산 뉴스 · 최근 1년" },
];
const PAGE = 40;                     // 한 번에 보여 줄 글 수 (더 보기로 늘립니다)
const PREF = "skyish-news-cat";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** 같은 화면 안에서 한 번 받은 갈래는 다시 받지 않습니다 */
const cache = {};
async function load(k) {
  if (cache[k]) return cache[k];
  const r = await fetch("assets/data/news/" + k + ".json?v=" + Math.floor(Date.now() / 36e5), { cache: "no-cache" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return (cache[k] = await r.json());
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
    try { doc = await load(cat); }
    catch (e) {
      list.innerHTML = '<li class="nws__empty">아직 모아 둔 뉴스가 없습니다.</li>';
      note.textContent = meta.note;
      srcBox.innerHTML = ""; more.hidden = true;
      return;
    }
    const items = doc.items || [];
    const srcs = doc.sources || [];
    srcBox.innerHTML =
      `<button type="button" data-s="" class="${src ? "" : "on"}">전체 <b>${items.length}</b></button>` +
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
        `<a href="${esc(it.u)}" target="_blank" rel="noopener">${esc(it.t)}</a>` +
        `<span class="nws__src">${esc(it.src)}</span>` +
        (it.s ? `<span class="nws__s">${esc(it.s)}</span>` : "") + "</li>";
    }).join("");
    more.hidden = pick.length <= shown;
    more.textContent = "더 보기 (" + (pick.length - shown) + "건 남음)";
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
