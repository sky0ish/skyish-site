/* Gallery › Architects · Architecture 의 「노트」
   ─ 건축가 노트 : 1. 이력  2. 유명해진 이유  3. 건축특성 및 이론(+대표 저서)  4. 건축가 및 예술가 네트워크  5. 대표작품  + References
                   프리츠커 수상자 전체를 먼저(수상 연도 차례), 그다음 ArchDaily 의 다른 세계적 건축가
   ─ 건축가에게 주는 상 목록 · 맨 아래 건축가 네트워크 망 (텍스트마이닝 그림처럼)
   ─ 건축물 노트 : 1) 건축가 개요 2) 건축개요 3) 컨셉 · 우수한 이유 4) 공간특성 5) 재료 및 구조 + References
                   건축물에 주는 상 목록
   자료: assets/data/architects.json · buildings.json  (tools/architects/build.py 가 만듭니다) */

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const V = "202610041600";
let DATA = null, BLD = null;

async function load() {
  if (!DATA) DATA = fetch("assets/data/architects.json?v=" + V).then((r) => r.json());
  return DATA;
}
async function loadB() {
  if (!BLD) BLD = fetch("assets/data/buildings.json?v=" + V).then((r) => (r.ok ? r.json() : { items: [] }))
    .catch(() => ({ items: [] }));
  return BLD;
}

const fold = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/* 글 제목 — <프리츠커 수상자> [미국] 건축가명_회사명 (출생일~사망일) */
function life(a) {
  if (a.born) return `${a.born}~${a.died || ""}`;
  if (a.founded) return `${a.founded} 설립~`;
  return "";
}
function titleHtml(a) {
  const who = a.person || a.ko;
  const firm = a.firm && fold(a.firm) !== fold(who) ? "_" + a.firm : "";
  return (a.pritzker ? `<span class="an__tag">&lt;프리츠커 수상자&gt;</span> ` : "") +
    `<span class="an__nat">[${esc(a.nat || "")}]</span> <b>${esc(who)}</b>${esc(firm)}` +
    (life(a) ? ` <span class="an__life">(${esc(life(a))})</span>` : "");
}

const credit = (img) => img ? `<figcaption>사진: <a href="${esc(img.page)}" target="_blank" rel="noopener">${esc(img.artist || "Wikimedia Commons")}</a>` +
  ` · ${esc(img.license || "")} · Wikimedia Commons</figcaption>` : "";
const refsHtml = (refs) => (refs || []).map((r) =>
  `<a href="${esc(r.u)}" target="_blank" rel="noopener">${esc(r.t)} ↗</a>`).join("");

function bodyHtml(a, byId, awardName) {
  const net = (a.net || []).map((n) => {
    const t = byId[n.id] ? `<a href="#ar-${esc(n.id)}" data-go="${esc(n.id)}">${esc(n.n)}</a>` : esc(n.n);
    return `<li>${t} <span>— ${esc(n.r)}</span></li>`;
  }).join("");
  const aw = (a.awards || []).map((x) =>
    `<span class="an__aw an__aw--${esc(x.id)}">${esc(x.y)} ${esc(awardName[x.id] || x.ko)}${x.work ? " · " + esc(x.work) : ""}</span>`).join("");
  const works = (a.works || []).map((w) => `
    <figure class="an__work">
      ${w.img ? `<a href="${esc(w.img.page)}" target="_blank" rel="noopener"><img src="${esc(w.img.src)}" alt="${esc(w.ko)}" loading="lazy"></a>`
              : `<span class="an__noimg">자유 이용 사진 없음<br><small>아래 링크에서 보기</small></span>`}
      <figcaption>
        <b>${esc(w.ko)}</b> <small>${esc(w.t)}</small>
        <span class="an__wm">${esc(w.y || "")} · ${esc(w.at || "")}</span>
        <span class="an__wp">${esc(w.p || "")}</span>
        <span class="an__refs">${refsHtml(w.refs)}</span>
        ${w.img ? `<small class="an__cr">사진: ${esc(w.img.artist || "")} · ${esc(w.img.license || "")}</small>` : ""}
      </figcaption>
    </figure>`).join("");
  return `
    <div class="an__body">
      <h4>1. 이력</h4>
      <div class="an__life1">
        ${a.img ? `<figure class="an__por"><img src="${esc(a.img.src)}" alt="${esc(a.ko)}" loading="lazy">${credit(a.img)}</figure>` : ""}
        <div>${(a.life || []).map((p) => `<p>${esc(p)}</p>`).join("")}
          ${aw ? `<p class="an__aws"><b>주요 수상</b> ${aw}</p>` : ""}</div>
      </div>
      <h4>2. 유명해진 이유</h4>
      <p class="an__why">${esc(a.why || "")}</p>
      <h4>3. 건축특성 및 이론</h4>
      <dl class="an__theory">${(a.theory || []).map((t) => `<dt>${esc(t.h)}</dt><dd>${esc(t.p)}</dd>`).join("")}</dl>
      ${(a.books || []).length ? `<p class="an__bk"><b>대표 저서</b></p><ul class="an__books">${a.books.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
      <h4>4. 건축가 및 예술가 네트워크</h4>
      <ul class="an__net">${net}</ul>
      <h4>5. 대표작품</h4>
      <div class="an__works">${works}</div>
      <h4 class="an__refh">References</h4>
      <p class="an__refs an__refs--big">${refsHtml(a.refs)}</p>
    </div>`;
}

/* 상 목록 표 */
function awardsHtml(list, byId, kind) {
  return list.map((aw) => {
    const rows = aw.rows.map((r) => {
      const who = (r.ids || []).length
        ? r.ids.map((i) => byId[i] ? `<a href="#ar-${esc(i)}" data-go="${esc(i)}">${esc(byId[i].person || byId[i].ko)}</a>` : "").join(", ") +
          ` <small>${esc(r.who)}</small>`
        : (r.ko ? `${esc(r.ko)} <small>${esc(r.who)}</small>` : esc(r.who));
      const work = r.work ? (r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.work)}</a>`
        : r.wlinks && r.wlinks[0] ? `<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(r.wlinks[0].replace(/ /g, "_"))}" target="_blank" rel="noopener">${esc(r.work)}</a>`
        : esc(r.work)) : "";
      return kind === "building"
        ? `<tr><td>${esc(r.y)}</td><td>${work}${r.note ? ` <small>(${esc(r.note)})</small>` : ""}</td><td>${who || ""}</td></tr>`
        : `<tr><td>${esc(r.y)}</td><td>${who}</td><td>${esc(r.nat || "")}</td></tr>`;
    }).join("");
    return `<details class="an__award">
      <summary><b>${esc(aw.ko)}</b> <small>${esc(aw.en)} · ${esc(aw.since)}~ · ${esc(aw.by)} · ${aw.rows.length}건</small></summary>
      <p class="an__about">${esc(aw.about)} <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(aw.wiki.replace(/ /g, "_"))}" target="_blank" rel="noopener">Wikipedia ↗</a></p>
      <div class="an__tw"><table class="an__tb">
        <thead><tr>${kind === "building" ? "<th>연도</th><th>건축물</th><th>건축가</th>" : "<th>연도</th><th>수상자</th><th>국적</th>"}</tr></thead>
        <tbody>${rows}</tbody></table></div>
    </details>`;
  }).join("");
}

/* ── 네트워크 망 — 노트의 「4. 네트워크」를 이어 그립니다 ──
   점: 이 노트의 건축가(초록=프리츠커, 주황=그 밖) + 두 명 이상이 함께 꼽은 인물·기관(회색)
   선: 노트끼리 직접 이은 관계, 그리고 같은 인물을 함께 꼽은 관계 */
function graph(items) {
  const byId = Object.fromEntries(items.map((a) => [a.id, a]));
  const nodes = items.map((a) => ({ id: a.id, label: a.person && a.person.length < 9 ? a.person : a.ko.split(" (")[0].split(" · ")[0], kind: a.pritzker ? "p" : "o" }));
  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const E = new Map();                       // 선 하나 = { a, b, rel: [{ from(누구의 노트에서), n(꼽은 이름), r(관계) }] }
  const link = (a, b, rel) => {
    const k = key(a, b);
    if (!E.has(k)) E.set(k, { a, b, rel: [] });
    if (!E.get(k).rel.some((x) => x.from === rel.from && x.r === rel.r)) E.get(k).rel.push(rel);
  };
  const hubs = {};
  items.forEach((a) => (a.net || []).forEach((n) => {
    if (n.id && byId[n.id] && n.id !== a.id) { link(a.id, n.id, { from: a.id, n: n.n, r: n.r }); return; }
    if (n.id) return;
    n.n.split(/\s*·\s*|\s*,\s*/).forEach((nm) => {
      nm = nm.replace(/\s*\(.*?\)\s*/g, "").trim();
      if (nm.length < 2 || /(갤러리|대학|재단|공동체|시$|프로젝트|협회|학교)/.test(nm)) return;
      (hubs[nm] = hubs[nm] || []).push({ id: a.id, n: n.n, r: n.r });
    });
  }));
  Object.entries(hubs).forEach(([nm, list]) => {
    if (new Set(list.map((x) => x.id)).size < 2) return;
    const hid = "h:" + nm;
    nodes.push({ id: hid, label: nm, kind: "h" });
    list.forEach((x) => link(hid, x.id, { from: x.id, n: x.n, r: x.r }));
  });
  const edges = [...E.values()];
  const deg = {};
  edges.forEach(({ a, b }) => { deg[a] = (deg[a] || 0) + 1; deg[b] = (deg[b] || 0) + 1; });
  nodes.forEach((n) => (n.deg = deg[n.id] || 0));
  return { nodes, edges };
}

function layout(nodes, edges, W, H) {
  /* Fruchterman–Reingold — 밀어내는 힘 k²/d, 당기는 힘 d²/k, 가운데로 모으는 힘, 식어 가는 온도 */
  const idx = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
  const N = nodes.length, k = Math.sqrt((W * H) / N) * 0.62;
  nodes.forEach((n, i) => {           // 처음 자리 — 늘 같은 그림이 나오도록 정해진 나선
    const r = 30 + 260 * Math.sqrt((i + 0.5) / N), t = i * 2.39996;
    n.x = W / 2 + r * Math.cos(t); n.y = H / 2 + r * Math.sin(t) * 0.7;
  });
  const L = edges.map((e) => [idx[e.a], idx[e.b]]);
  const IT = 500;
  for (let it = 0; it < IT; it++) {
    const temp = 40 * (1 - it / IT) + 0.5;
    const dx = new Float64Array(N), dy = new Float64Array(N);
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const ex = nodes[i].x - nodes[j].x, ey = nodes[i].y - nodes[j].y;
      const d = Math.max(1, Math.hypot(ex, ey)), f = (k * k) / d;
      dx[i] += ex / d * f; dy[i] += ey / d * f; dx[j] -= ex / d * f; dy[j] -= ey / d * f;
    }
    L.forEach(([i, j]) => {
      const ex = nodes[i].x - nodes[j].x, ey = nodes[i].y - nodes[j].y;
      const d = Math.max(1, Math.hypot(ex, ey)), f = (d * d) / k;
      dx[i] -= ex / d * f; dy[i] -= ey / d * f; dx[j] += ex / d * f; dy[j] += ey / d * f;
    });
    for (let i = 0; i < N; i++) {
      const n = nodes[i];
      dx[i] += (W / 2 - n.x) * 0.9; dy[i] += (H / 2 - n.y) * 1.3;      // 가운데로 (세로를 더 세게 — 가로로 긴 그림)
      const d = Math.max(1, Math.hypot(dx[i], dy[i])), m = Math.min(d, temp);
      n.x = Math.max(40, Math.min(W - 40, n.x + dx[i] / d * m));
      n.y = Math.max(26, Math.min(H - 20, n.y + dy[i] / d * m));
    }
  }
}

let NET = null;                               // 마지막으로 그린 망 (선을 누르면 관계를 찾아 보여 줍니다)
function netHtml(items) {
  const W = 1100, H = 760;
  const { nodes, edges } = graph(items);
  layout(nodes, edges, W, H);
  const at = Object.fromEntries(nodes.map((n) => [n.id, n]));
  NET = { at, edges, byId: Object.fromEntries(items.map((a) => [a.id, a])) };
  const r = (n) => (n.kind === "h" ? 3.5 : 5) + Math.sqrt(n.deg) * 2.6;
  const fs = (n) => Math.min(19, 10.5 + n.deg * 0.9);
  const xy = (e) => `x1="${at[e.a].x.toFixed(1)}" y1="${at[e.a].y.toFixed(1)}" x2="${at[e.b].x.toFixed(1)}" y2="${at[e.b].y.toFixed(1)}"`;
  return `<svg class="annet__svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="건축가 네트워크 망">
    <g class="annet__e">${edges.map((e, i) =>
      `<g data-i="${i}" data-a="${esc(e.a)}" data-b="${esc(e.b)}"><line class="v" ${xy(e)}/><line class="hit" ${xy(e)}><title>누르면 관계 설명</title></line></g>`).join("")}</g>
    <g class="annet__n">${nodes.map((n) =>
      `<g class="k-${n.kind}" data-id="${esc(n.id)}" transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})">` +
      `<circle r="${r(n).toFixed(1)}"/><text y="${(-r(n) - 3).toFixed(1)}" font-size="${fs(n).toFixed(1)}">${esc(n.label)}</text></g>`).join("")}</g>
  </svg><div class="annet__pop" hidden></div>`;
}

function wireNet(box, openEntry) {
  const svg = box.querySelector("svg"), pop = box.querySelector(".annet__pop");
  if (!svg || !NET) return;
  const eds = [...svg.querySelectorAll(".annet__e > g")];
  const nbr = {};
  NET.edges.forEach(({ a, b }) => {
    (nbr[a] = nbr[a] || new Set()).add(b);
    (nbr[b] = nbr[b] || new Set()).add(a);
  });
  const focus = (id, edge) => {
    svg.classList.toggle("on", !!(id || edge));
    svg.querySelectorAll(".annet__n > g").forEach((g) => g.classList.toggle("hi",
      edge ? (g.dataset.id === edge.a || g.dataset.id === edge.b)
           : !!id && (g.dataset.id === id || (nbr[id] && nbr[id].has(g.dataset.id)))));
    eds.forEach((g) => g.classList.toggle("hi", edge ? NET.edges[+g.dataset.i] === edge
      : !!id && (g.dataset.a === id || g.dataset.b === id)));
  };
  let pinned = null;                          // 관계 창이 열려 있는 선
  const name = (id) => id.startsWith("h:") ? id.slice(2) : (NET.at[id] ? NET.at[id].label : id);
  const show = (e, ev) => {
    pinned = e;
    focus(null, e);
    const hub = e.a.startsWith("h:") ? e.a : e.b.startsWith("h:") ? e.b : "";
    const rows = e.rel.map((x) => {
      const other = x.from === e.a ? e.b : e.a;
      return `<li><b>${esc(name(x.from))}</b> 의 노트에서 <b>${esc(hub ? x.n : name(other))}</b> — ${esc(x.r)}</li>`;
    }).join("");
    const ends = [e.a, e.b].filter((i) => !i.startsWith("h:"));
    pop.innerHTML = `<button type="button" class="x" aria-label="닫기">✕</button>
      <p class="h"><b>${esc(name(e.a))}</b> <span>↔</span> <b>${esc(name(e.b))}</b></p>
      <p class="k">${hub ? `두 사람 이상이 함께 꼽은 인물 「${esc(hub.slice(2))}」 과(와)의 관계` : "건축가 노트끼리 직접 이어진 관계"}</p>
      <ul>${rows}</ul>
      <p class="go">${ends.map((i) => `<button type="button" data-open="${esc(i)}">${esc(name(i))} 노트 열기 →</button>`).join("")}</p>`;
    pop.hidden = false;
    const bx = box.getBoundingClientRect();
    const x = Math.min(Math.max(8, ev.clientX - bx.left + 12), bx.width - Math.min(360, bx.width - 16) - 8);
    const y = Math.min(ev.clientY - bx.top + 12, bx.height - 40);
    pop.style.left = x + "px"; pop.style.top = Math.max(8, y) + "px";
  };
  const hide = () => { pinned = null; pop.hidden = true; focus(null); };
  eds.forEach((g) => {
    g.addEventListener("click", (ev) => { ev.stopPropagation(); show(NET.edges[+g.dataset.i], ev); });
    g.addEventListener("mouseenter", () => { if (!pinned) focus(null, NET.edges[+g.dataset.i]); });
    g.addEventListener("mouseleave", () => { if (!pinned) focus(null); });
  });
  pop.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (ev.target.closest(".x")) return hide();
    const o = ev.target.closest("[data-open]");
    if (o) { hide(); openEntry(o.dataset.open); }
  });
  svg.addEventListener("click", hide);
  svg.querySelectorAll(".annet__n > g").forEach((g) => {
    g.addEventListener("mouseenter", () => { if (!pinned) focus(g.dataset.id); });
    g.addEventListener("mouseleave", () => { if (!pinned) focus(null); });
    g.addEventListener("click", (ev) => { ev.stopPropagation(); if (!g.dataset.id.startsWith("h:")) openEntry(g.dataset.id); });
  });
}

/* ── 건축가 노트 그리기 ── */
export async function drawArchitects(el, qv) {
  el.innerHTML = '<p class="an__wait">건축가 노트를 불러오는 중…</p>';
  let d;
  try { d = await load(); } catch (e) { el.innerHTML = '<p class="an__wait">건축가 노트를 불러오지 못했습니다.</p>'; return; }
  const all = d.items;
  const byId = Object.fromEntries(all.map((a) => [a.id, a]));
  const awardName = Object.fromEntries(d.awards.architect.concat(d.awards.building).map((a) => [a.id, a.ko]));
  /* 수상 연도 차례 — 최근 수상을 위로, 옛 수상을 아래로 */
  const lastAw = (a) => Math.max(0, ...(a.awards || []).map((x) => x.y));
  const pz = all.filter((a) => a.pritzker).sort((a, b) => b.pritzker - a.pritzker);
  const others = all.filter((a) => !a.pritzker).sort((a, b) => lastAw(b) - lastAw(a));
  const q = fold(qv || "").trim();
  const hit = (a) => !q || fold([a.name, a.ko, a.person, a.firm, a.nat, a.why, (a.works || []).map((w) => w.ko + " " + w.t).join(" ")].join(" ")).includes(q);
  let filt = "all";
  try { filt = localStorage.getItem("skyish-an-filt") || "all"; } catch (e) {}

  const listHtml = () => {
    const show = (filt === "other" ? [] : pz.filter(hit)).concat(filt === "pz" ? [] : others.filter(hit));
    if (!show.length) return '<p class="an__wait">찾는 건축가가 없습니다.</p>';
    return `<ol class="an__list">${show.map((a) => `
      <li><details class="an" id="ar-${esc(a.id)}" data-id="${esc(a.id)}">
        <summary><span class="an__t">${titleHtml(a)}</span>${a.pritzker ? `<span class="an__yr">${esc(a.pritzker)}</span>` : ""}</summary>
      </details></li>`).join("")}</ol>`;
  };
  el.innerHTML = `
    <section class="annote">
      <div class="an__head">
        <h3>건축가 노트</h3>
        <p>ArchDaily 가 다루는 건축가들 — <b>프리츠커 수상자 ${pz.length}명</b>(최근 수상부터)을 먼저, 그다음 세계적 건축가 ${others.length}명(최근 수상부터).
           각 글은 1. 이력 · 2. 유명해진 이유 · 3. 건축특성 및 이론 · 4. 건축가 및 예술가 네트워크 · 5. 대표작품 차례입니다.
           생몰일 · 수상 연도는 위키데이터 · 위키백과에서, 사진은 위키미디어 공용의 자유 이용 사진만 씁니다.</p>
        <div class="an__chips">
          <button type="button" data-f="all">전체 ${all.length}</button>
          <button type="button" data-f="pz">프리츠커 수상자 ${pz.length}</button>
          <button type="button" data-f="other">그 밖의 건축가 ${others.length}</button>
          <a href="#an-awards">건축가 상 목록 ↓</a><a href="#an-net">네트워크 망 ↓</a>
        </div>
      </div>
      <div id="anList"></div>
      <h3 class="an__sec" id="an-awards">건축가에게 주는 상</h3>
      <p class="an__note">수상자 이름을 누르면 그 건축가의 노트로 갑니다. 기준일 ${esc(d.made)}.</p>
      ${awardsHtml(d.awards.architect, byId, "architect")}
      <h3 class="an__sec" id="an-net">건축가 네트워크 망</h3>
      <p class="an__note">각 노트의 「4. 건축가 및 예술가 네트워크」를 이어 그린 그림입니다 — 스승 · 제자 · 동료 · 협업 관계.
        <span class="an__lg"><i class="k-p"></i>프리츠커 수상자 <i class="k-o"></i>그 밖의 건축가 <i class="k-h"></i>여러 건축가가 함께 꼽은 인물</span>
        점이 클수록 이어진 사람이 많습니다. 점에 마우스를 올리면 이웃이 드러나고, 점을 누르면 노트가 열립니다. <b>선을 누르면 두 사람이 어떤 관계인지</b> 설명 창이 뜹니다.</p>
      <div class="annet" id="anNet">${netHtml(all)}</div>
    </section>`;

  const listEl = el.querySelector("#anList");
  const openEntry = (id) => {
    if (!el.querySelector("#ar-" + id)) { filt = "all"; paint(); }
    const det = el.querySelector("#ar-" + id);
    if (!det) return;
    det.open = true;
    det.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const paint = () => {
    listEl.innerHTML = listHtml();
    el.querySelectorAll(".an__chips button").forEach((b) => b.classList.toggle("on", b.dataset.f === filt));
    listEl.querySelectorAll("details.an").forEach((det) => det.addEventListener("toggle", () => {
      if (det.open && !det.querySelector(".an__body")) det.insertAdjacentHTML("beforeend", bodyHtml(byId[det.dataset.id], byId, awardName));
    }));
  };
  paint();
  el.querySelectorAll(".an__chips button").forEach((b) => b.addEventListener("click", () => {
    filt = b.dataset.f;
    try { localStorage.setItem("skyish-an-filt", filt); } catch (e) {}
    paint();
  }));
  el.onclick = (e) => {          // 다시 그려도 한 번만 걸리게
    const a = e.target.closest("[data-go]");
    if (!a) return;
    e.preventDefault();
    openEntry(a.dataset.go);
  };
  wireNet(el.querySelector("#anNet"), openEntry);
  const h = decodeURIComponent(location.hash || "");          // Architecture 에서 건축가 이름을 눌러 왔을 때
  if (h.startsWith("#ar-")) openEntry(h.slice(4));
}

/* ── 건축물 노트 그리기 (Architecture) ── */
const paras = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((p) => `<p>${esc(p)}</p>`).join("");
function bldBody(b, arch) {
  const fig = (im) => `<figure class="ab__fig">
      <a href="${esc(im.page)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(im.cap || "")}" loading="lazy"></a>
      <figcaption>${im.cap ? `<b>${esc(im.cap)}</b> · ` : ""}${esc(im.artist || "")} · ${esc(im.license || "")} · Wikimedia Commons</figcaption></figure>`;
  const figs = (list, none) => (list || []).length ? `<div class="ab__figs">${list.map(fig).join("")}</div>`
    : (none ? `<p class="ab__none">${none}</p>` : "");
  /* ArchDaily 의 그 그림 한 장 한 장으로 바로 가는 링크 (그림은 저작권이 있어 싣지 않고 이어 줍니다) */
  const AD = b.ad || null;
  const adLinks = (kind) => {
    if (!AD && !(b.more || []).some((d) => d.kind === kind)) return "";
    const list = ((AD && AD.drawings) || []).filter((d) => d.kind === kind);
    const seen = {};
    const one = (d) => {
      seen[d.label] = (seen[d.label] || 0) + 1;
      const n = list.filter((x) => x.label === d.label).length > 1 ? " " + seen[d.label] : "";
      return `<a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(d.label + n)} ↗</a>`;
    };
    const other = (b.more || []).filter((d) => d.kind === kind);
    const seen2 = {};
    const two = (d) => {
      const k = d.site + d.label;
      seen2[k] = (seen2[k] || 0) + 1;
      const n = other.filter((x) => x.site + x.label === k).length > 1 ? " " + seen2[k] : "";
      return `<a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(d.label + n)} <small>${esc(d.site)}</small> ↗</a>`;
    };
    if (list.length || other.length) return list.map(one).join("") + other.map(two).join("");
    if (kind === "concept" || kind === "build")
      return AD && AD.photo ? `<a href="${esc(AD.photo)}" target="_blank" rel="noopener">ArchDaily 사진 갤러리 ↗</a>` : "";
    return AD ? `<a href="${esc(AD.u)}" target="_blank" rel="noopener">ArchDaily 프로젝트 페이지 ↗</a>` : "";
  };
  const look = (kind, has) => {
    const l = adLinks(kind);
    if (!l) return "";
    return `<p class="ab__ad"><span>${has ? "더 보기" : "자유 이용 그림이 없어 여기 싣지 못했습니다 — 바로 보기"}</span>${l}</p>`;
  };
  const A = arch ? `<p><a href="gallery.html?cat=architects#ar-${esc(arch.id)}" class="ab__arch">${titleHtml(arch)} →</a></p>` : "";
  return `<div class="an__body">
    <h4>1) 건축가 개요</h4>
    ${A}${paras(b.archAbout)}
    <h4>2) 건축개요</h4>
    <table class="ab__spec"><tbody>${(b.spec || []).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>
    <h4>3) 건축물 컨셉 및 우수한 이유</h4>
    ${figs(b.imgs && b.imgs.concept, "")}${look("concept", b.imgs && b.imgs.concept.length)}
    ${paras(b.concept)}
    ${b.quote ? `<blockquote class="ab__q">${esc(b.quote)}<small>— 건축가의 설명 (요약 · 번역)</small></blockquote>` : ""}
    <div class="ab__why"><b>우수한 이유</b>${Array.isArray(b.why) ? `<ul>${b.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ` ${esc(b.why || "")}`}</div>
    <h4>4) 건축물 공간특성 — 평면도 · 입면도 · 단면도</h4>
    ${figs(b.imgs && b.imgs.plan, "")}${look("plan", b.imgs && b.imgs.plan.length)}
    ${paras(b.space)}
    <h4>5) 건축물 재료 및 구조</h4>
    ${figs(b.imgs && b.imgs.build, "")}${look("build", b.imgs && b.imgs.build.length)}
    ${paras(b.material)}
    <h4 class="an__refh">References</h4>
    <p class="an__refs an__refs--big">${refsHtml(b.refs)}</p>
  </div>`;
}

export async function drawBuildings(el, qv) {
  el.innerHTML = '<p class="an__wait">건축물 노트를 불러오는 중…</p>';
  let d, b;
  try { [d, b] = await Promise.all([load(), loadB()]); } catch (e) { el.innerHTML = '<p class="an__wait">건축물 노트를 불러오지 못했습니다.</p>'; return; }
  const byId = Object.fromEntries(d.items.map((a) => [a.id, a]));
  const q = fold(qv || "").trim();
  const items = (b.items || []).filter((x) => !q || fold([x.t, x.ko, x.at, x.archName].join(" ")).includes(q));
  el.innerHTML = `
    <section class="annote">
      <div class="an__head">
        <h3>건축물 노트</h3>
        <p>이름난 건축상을 받은 건축물들 — 1) 건축가 개요 · 2) 건축개요 · 3) 컨셉(조감도 · 분해도 · 컨셉드로잉)과 우수한 이유 ·
           4) 공간특성(평면도 · 입면도) · 5) 재료 및 구조. 그림은 위키미디어 공용의 자유 이용 그림만 싣고, 없으면 ArchDaily 로 이어 둡니다.</p>
        <div class="an__chips"><a href="#ab-awards">건축물 상 목록 ↓</a></div>
      </div>
      ${items.length ? `<ol class="an__list">${items.map((x) => `
        <li><details class="an" id="bd-${esc(x.id)}" data-id="${esc(x.id)}">
          <summary><span class="an__t"><span class="an__tag an__tag--b">&lt;${esc(x.award || "")}&gt;</span> <span class="an__nat">[${esc(x.nat || "")}]</span>
            <b>${esc(x.ko)}</b>_${esc(x.t)} <span class="an__life">(준공 ${esc(x.y)} · ${esc(x.archName || "")})</span></span></summary>
        </details></li>`).join("")}</ol>` : '<p class="an__wait">찾는 건축물 노트가 없습니다.</p>'}
      <h3 class="an__sec" id="ab-awards">건축물에 주는 상</h3>
      <p class="an__note">건축가 이름을 누르면 Architects 의 건축가 노트로 갑니다. 기준일 ${esc(d.made)}.</p>
      ${awardsHtml(d.awards.building, byId, "building")}
    </section>`;
  const map = Object.fromEntries((b.items || []).map((x) => [x.id, x]));
  el.querySelectorAll("details.an").forEach((det) => det.addEventListener("toggle", () => {
    if (det.open && !det.querySelector(".an__body")) {
      const x = map[det.dataset.id];
      det.insertAdjacentHTML("beforeend", bldBody(x, byId[x.arch]));
    }
  }));
  el.onclick = (e) => {          // 다시 그려도 한 번만 걸리게
    const a = e.target.closest("[data-go]");
    if (!a) return;
    e.preventDefault();
    location.href = "gallery.html?cat=architects#ar-" + a.dataset.go;
  };
}
