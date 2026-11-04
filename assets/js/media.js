// ─── BLOG ▸ NEWS / YOUTUBE ──────────────────────────────────
//
//   경기연구원 남지현이 나온 언론 기사와 유튜브 영상.
//   목록은 assets/data/news/me-news.json · me-youtube.json 에 있습니다.
//     · 처음 목록은 손으로 확인해 담았고,
//     · 그 뒤로는 tools/news/me.py 가 날마다 아침 새 것을 더합니다 (collect.py 다음에, .github/workflows/news.yml).
//   같은 이름의 배우·가수·앵커는 담지 않습니다. 누구나 봅니다.
//
//   media.html?tab=news | media.html?tab=youtube

const TABS = {
  news:    { file: "news",    title: "NEWS",    lead: "경기연구원 남지현이 나온 언론 기사입니다. 제목을 누르면 기사 원문이 새 창으로 열립니다." },
  youtube: { file: "youtube", title: "YOUTUBE", lead: "경기연구원 남지현이 발표·토론·인터뷰로 나온 영상입니다. 그림을 누르면 이 자리에서 재생됩니다." },
};

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const stamp = () => Math.floor(Date.now() / 36e5);
const cache = {};

async function load(k) {
  if (cache[k]) return cache[k];
  const r = await fetch("assets/data/news/me-" + TABS[k].file + ".json?v=" + stamp(), { cache: "no-cache" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const doc = await r.json();
  const hide = new Set(doc.hide || []);
  doc.items = (doc.items || []).filter((x) => !hide.has(x.u || x.id));
  return (cache[k] = doc);
}

const $ = (id) => document.getElementById(id);
let tab = /[?&]tab=youtube/.test(location.search) ? "youtube" : "news";
let year = "all";
let q = "";

function text(it) {
  return [it.t, it.src, it.ch, it.s, it.role, it.d].join(" ").toLowerCase();
}

function yearsBar(items) {
  const n = {};
  items.forEach((x) => { const y = (x.d || "").slice(0, 4) || "?"; n[y] = (n[y] || 0) + 1; });
  const ys = Object.keys(n).sort().reverse();
  if (year !== "all" && !n[year]) year = "all";
  $("mdYears").innerHTML =
    `<button type="button" data-y="all" class="${year === "all" ? "on" : ""}">전체 <b>${items.length}</b></button>` +
    ys.map((y) => `<button type="button" data-y="${esc(y)}" class="${year === y ? "on" : ""}">${esc(y)} <b>${n[y]}</b></button>`).join("");
}

function fmtDate(d) {
  return (d || "").slice(5).replace("-", ".");
}

function newsHtml(items) {
  let last = "";
  return '<ol class="nws__list md-news">' + items.map((it) => {
    const y = (it.d || "").slice(0, 4);
    const head = y !== last ? `<li class="nws__mon">${esc(y)}</li>` : "";
    last = y;
    const host = it.src || "";
    return head +
      `<li class="nws__it"><span class="nws__d">${esc(fmtDate(it.d))}</span>` +
      `<a href="${esc(it.u)}" target="_blank" rel="noopener">${esc(it.t)}</a>` +
      (host ? `<span class="nws__badge md-badge">${esc(host)}</span>` : "<span></span>") +
      (it.s ? `<span class="nws__s">${esc(it.s)}</span>` : "") +
      "</li>";
  }).join("") + "</ol>";
}

function ytHtml(items) {
  return '<ul class="md-yt">' + items.map((it) => {
    const watch = "https://www.youtube.com/watch?v=" + encodeURIComponent(it.id);
    const meta = [it.ch, (it.d || "").replace(/-/g, "."), it.len].filter(Boolean).map(esc).join(" · ");
    return '<li class="md-yt__it">' +
      `<button type="button" class="md-yt__play" data-id="${esc(it.id)}" aria-label="${esc(it.t)} 재생">` +
        `<img src="https://i.ytimg.com/vi/${esc(it.id)}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180" onerror="this.style.visibility='hidden'">` +
        (it.len ? `<span class="md-yt__len">${esc(it.len)}</span>` : "") +
        '<span class="md-yt__btn" aria-hidden="true"></span>' +
      "</button>" +
      '<div class="md-yt__txt">' +
        `<a class="md-yt__t" href="${watch}" target="_blank" rel="noopener">${esc(it.t)}</a>` +
        `<p class="md-yt__m">${meta}</p>` +
        (it.k ? `<a class="md-yt__talk" href="talk.html?k=${encodeURIComponent(it.k)}">발표 개요 ›</a>` : "") +
        (it.s ? `<p class="md-yt__s">${esc(it.s)}</p>` : "") +
      "</div></li>";
  }).join("") + "</ul>";
}

function draw(doc) {
  yearsBar(doc.items);
  const pick = doc.items
    .filter((x) => year === "all" || (x.d || "").startsWith(year))
    .filter((x) => !q || text(x).includes(q))
    .sort((a, b) => (b.d || "").localeCompare(a.d || ""));
  $("mdNote").innerHTML =
    `모두 ${doc.items.length}건` + (doc.updated ? ` · 마지막으로 모은 때 ${esc(doc.updated)}` : "") +
    " · 날마다 아침 새 것을 더합니다. 같은 이름의 배우·앵커 기사·영상은 뺐습니다.";
  if (!pick.length) {
    $("mdBody").innerHTML = '<p class="nws__empty">' + (doc.items.length ? "맞는 것이 없습니다." : "아직 모아 둔 것이 없습니다.") + "</p>";
    return;
  }
  $("mdBody").innerHTML = tab === "news" ? newsHtml(pick) : ytHtml(pick);
}

async function show() {
  const t = TABS[tab];
  $("mdTitle").textContent = t.title;
  $("mdLead").textContent = t.lead;
  document.title = t.title + " — Jee-Hyun NAM";
  [].forEach.call($("mdTabs").querySelectorAll("button"), (b) => b.classList.toggle("on", b.dataset.tab === tab));
  $("mdQ").placeholder = tab === "news" ? "낱말로 찾기 (예: 반환공여지)" : "낱말로 찾기 (예: 토론회)";
  $("mdBody").innerHTML = '<p class="nws__empty">불러오는 중…</p>';
  try {
    draw(await load(tab));
  } catch (e) {
    $("mdBody").innerHTML = '<p class="nws__empty">목록을 읽지 못했습니다 — 잠시 뒤 다시 열어 주세요.</p>';
  }
}

$("mdTabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (!b || b.dataset.tab === tab) return;
  tab = b.dataset.tab; year = "all";
  history.replaceState(null, "", "media.html?tab=" + tab);
  show();
});
$("mdYears").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-y]");
  if (!b) return;
  year = b.dataset.y;
  if (cache[tab]) draw(cache[tab]);
});
let qt;
$("mdQ").addEventListener("input", (e) => {
  clearTimeout(qt);
  qt = setTimeout(() => { q = e.target.value.trim().toLowerCase(); if (cache[tab]) draw(cache[tab]); }, 150);
});
/* 그림을 누르면 그 자리에서 재생 (youtube-nocookie) */
$("mdBody").addEventListener("click", (e) => {
  const b = e.target.closest(".md-yt__play");
  if (!b) return;
  const f = document.createElement("iframe");
  f.className = "md-yt__frame";
  f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(b.dataset.id) + "?autoplay=1&rel=0";
  f.title = b.getAttribute("aria-label") || "YouTube";
  f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
  f.allowFullscreen = true;
  b.replaceWith(f);
});

show();
