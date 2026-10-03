import { decorate } from "./noteimg.js?v=202610051200";
/* Gallery › Architects · Architecture 의 「노트」
   ─ 건축가 노트 : 1. 이력  2. 유명해진 이유  3. 건축특성 및 이론(+대표 저서)  4. 건축가 및 예술가 네트워크  5. 대표작품  + References
                   프리츠커 수상자 전체를 먼저(수상 연도 차례), 그다음 ArchDaily 의 다른 세계적 건축가
   ─ 건축가에게 주는 상 목록 · 맨 아래 건축가 네트워크 망 (텍스트마이닝 그림처럼)
   ─ 건축물 노트 : 1) 건축가 개요 2) 건축개요 3) 컨셉 · 우수한 이유 4) 공간특성 5) 재료 및 구조 + References
                   건축물에 주는 상 목록
   자료: assets/data/architects.json · buildings.json  (tools/architects/build.py 가 만듭니다) */

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const V = "202610052330";
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
      if (det.open && !det.querySelector(".an__body")) { det.insertAdjacentHTML("beforeend", bodyHtml(byId[det.dataset.id], byId, awardName)); decorate(det, "architects", det.dataset.id); }
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
  /* 도면 · 그림 — ArchDaily · WikiArquitectura · 건축가 공식 페이지의 그림을 원래 자리에서 불러와 보여 줍니다
     (홈피 저장소에 복사하지 않음 · 그림을 누르면 원본 페이지로) */
  const AD = b.ad || null;
  const SITE = { "fondazionerenzopiano.org": "렌초 피아노 재단", "lacatonvassal.com": "Lacaton & Vassal",
                 "davidchipperfield.com": "David Chipperfield Architects", "rpbw.com": "Renzo Piano Building Workshop" };
  const ORDER = ["배치도", "평면", "입면", "단면", "액소", "분해", "다이어그램", "스케치", "모형", "상세", "구조", "도면"];
  const rank = (lb) => { const i = ORDER.findIndex((w) => lb.includes(w)); return i < 0 ? 99 : i; };
  const drawn = (kind) => {
    const all = (((AD && AD.drawings) || []).map((d) => Object.assign({ site: "ArchDaily" }, d)))
      .concat(b.more || []).filter((d) => d.kind === kind && d.img);
    all.sort((x, y) => rank(x.label) - rank(y.label));
    const cnt = {}, tot = {};
    all.forEach((d) => (tot[d.label] = (tot[d.label] || 0) + 1));
    return all.map((d) => {
      cnt[d.label] = (cnt[d.label] || 0) + 1;
      return Object.assign({ name: d.label + (tot[d.label] > 1 ? " " + cnt[d.label] : "") }, d);
    });
  };
  const dfig = (d) => `<figure class="ab__fig ab__fig--d">
      <a href="${esc(d.u)}" target="_blank" rel="noopener"><img src="${esc(d.img)}" alt="${esc(d.name)}" loading="lazy" referrerpolicy="no-referrer"
        onerror="this.closest('figure').classList.add('ab__fig--x')"></a>
      <figcaption><b>${esc(d.name)}</b> · 출처 <a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(SITE[d.site] || d.site)} ↗</a></figcaption></figure>`;
  const show = (kind, commons) => {
    const dr = drawn(kind);
    const cm = (commons || []);
    if (!dr.length && !cm.length) {
      if (kind === "plan") return `<p class="ab__none">공개된 도면을 찾지 못했습니다${AD ? ` — <a href="${esc(AD.u)}" target="_blank" rel="noopener">ArchDaily 프로젝트 페이지 ↗</a>` : ""}</p>`;
      return "";
    }
    return `<div class="ab__figs">${dr.map(dfig).join("")}${cm.map(fig).join("")}</div>` +
      (dr.length ? `<p class="ab__src">도면 · 그림의 저작권은 건축가와 각 출처에 있으며, 원본 페이지에서 불러와 보여 줍니다. 그림을 누르면 원본 페이지로 갑니다.</p>` : "");
  };
  const A = arch ? `<p><a href="gallery.html?cat=architects#ar-${esc(arch.id)}" class="ab__arch">${titleHtml(arch)} →</a></p>` : "";
  return `<div class="an__body">
    <h4>1) 건축가 개요</h4>
    ${A}${paras(b.archAbout)}
    <h4>2) 건축개요</h4>
    <table class="ab__spec"><tbody>${(b.spec || []).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>
    <h4>3) 건축물 컨셉 및 우수한 이유</h4>
    ${show("concept", b.imgs && b.imgs.concept)}
    ${paras(b.concept)}
    ${b.quote ? `<blockquote class="ab__q">${esc(b.quote)}<small>— 건축가의 설명 (요약 · 번역)</small></blockquote>` : ""}
    <div class="ab__why"><b>우수한 이유</b>${Array.isArray(b.why) ? `<ul>${b.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ` ${esc(b.why || "")}`}</div>
    <h4>4) 건축물 공간특성 — 평면도 · 입면도 · 단면도</h4>
    ${show("plan", b.imgs && b.imgs.plan)}
    ${paras(b.space)}
    <h4>5) 건축물 재료 및 구조</h4>
    ${show("build", b.imgs && b.imgs.build)}
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
           4) 공간특성(평면도 · 입면도 · 단면도) · 5) 재료 및 구조. 도면은 ArchDaily · WikiArquitectura · 건축가 공식 페이지에서 불러와 보여 주고(저작권은 각 출처), 사진은 위키미디어 공용의 자유 이용 사진을 씁니다.</p>
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
      decorate(det, "buildings", x.id);
    }
  }));
  el.onclick = (e) => {          // 다시 그려도 한 번만 걸리게
    const a = e.target.closest("[data-go]");
    if (!a) return;
    e.preventDefault();
    location.href = "gallery.html?cat=architects#ar-" + a.dataset.go;
  };
}

/* ── 그림 격자 (건축물 · 리노베이션 · 도시재생 공용) ──
   Commons 자유 이용 사진은 그대로, ArchDaily · WikiArquitectura · 공식 페이지의 도면은 원래 자리에서 불러와 보여 줍니다 */
const SITE_NAME = { "fondazionerenzopiano.org": "렌초 피아노 재단", "lacatonvassal.com": "Lacaton & Vassal",
                    "davidchipperfield.com": "David Chipperfield Architects", "rpbw.com": "Renzo Piano Building Workshop" };
const D_ORDER = ["배치도", "평면", "입면", "단면", "액소", "분해", "다이어그램", "스케치", "모형", "상세", "구조", "도면"];
function gridFor(b) {
  const AD = b.ad || null;
  const rank = (lb) => { const i = D_ORDER.findIndex((w) => lb.includes(w)); return i < 0 ? 99 : i; };
  const cfig = (im) => `<figure class="ab__fig">
      <a href="${esc(im.page)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(im.cap || "")}" loading="lazy"></a>
      <figcaption>${im.cap ? `<b>${esc(im.cap)}</b> · ` : ""}${esc(im.artist || "")} · ${esc(im.license || "")} · Wikimedia Commons</figcaption></figure>`;
  const dfig = (d) => `<figure class="ab__fig ab__fig--d">
      <a href="${esc(d.u)}" target="_blank" rel="noopener"><img src="${esc(d.img)}" alt="${esc(d.name)}" loading="lazy" referrerpolicy="no-referrer"
        onerror="this.closest(&quot;figure&quot;).classList.add(&quot;ab__fig--x&quot;)"></a>
      <figcaption><b>${esc(d.name)}</b> · 출처 <a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(SITE_NAME[d.site] || d.site)} ↗</a></figcaption></figure>`;
  return (kind, emptyNote) => {
    const all = (((AD && AD.drawings) || []).map((d) => Object.assign({ site: "ArchDaily" }, d)))
      .concat(b.more || []).filter((d) => d.kind === kind && d.img);
    all.sort((x, y) => rank(x.label) - rank(y.label));
    const cnt = {}, tot = {};
    all.forEach((d) => (tot[d.label] = (tot[d.label] || 0) + 1));
    const dr = all.map((d) => { cnt[d.label] = (cnt[d.label] || 0) + 1; return Object.assign({ name: d.label + (tot[d.label] > 1 ? " " + cnt[d.label] : "") }, d); });
    const cm = (b.imgs && b.imgs[kind]) || [];
    if (!dr.length && !cm.length)
      return emptyNote ? `<p class="ab__none">${emptyNote}${AD ? ` — <a href="${esc(AD.u)}" target="_blank" rel="noopener">ArchDaily 프로젝트 페이지 ↗</a>` : ""}</p>` : "";
    return `<div class="ab__figs">${dr.map(dfig).join("")}${cm.map(cfig).join("")}</div>` +
      (dr.length ? `<p class="ab__src">도면 · 그림의 저작권은 건축가와 각 출처에 있으며, 원본 페이지에서 불러와 보여 줍니다. 그림을 누르면 원본 페이지로 갑니다.</p>` : "");
  };
}
/* 줄 끝이 주소(https://…)면 첫 칸(법 · 계획 · 가이드라인 이름)을 그 원문으로 잇습니다 */
const kvTable = (rows) => (rows || []).length
  ? `<table class="ab__spec"><tbody>${rows.map((r0) => {
      const r = [...r0];
      const u = r.length > 2 && /^https?:\/\//.test(r[r.length - 1] || "") ? r.pop() : "";
      const k = u ? `<a href="${esc(u)}" target="_blank" rel="noopener" class="rg__law">${esc(r[0])} ↗</a>` : esc(r[0]);
      return r.length > 2
        ? `<tr><th class="rg__k">${k}</th><td><b>${esc(r[1])}</b><br><span class="rg__role">${esc(r[2])}</span></td></tr>`
        : `<tr><th>${k}</th><td>${esc(r[1])}</td></tr>`;
    }).join("")}</tbody></table>` : "";
/* 제목 줄의 「(원래 용도)에서 (변경 용도)로」 — 끝 글자 받침에 따라 로 / 으로 */
const ro = (w) => {
  const h = [...String(w || "")].reverse().find((c) => c >= "가" && c <= "힣");
  if (!h) return "로";
  const j = (h.charCodeAt(0) - 0xac00) % 28;
  return j === 0 || j === 8 ? "로" : "으로";
};
/* 용도 낱말마다 종류 색 — 꼬리표 규칙과 같게: 첨단산업 갈색 · 주거 노랑 · 업무 초록 · 상업 레드 · 문화 파랑 (그 밖은 짙은 회색) */
const USE_KIND = [
  ["tech", /첨단|연구|혁신|과학|기술|디지털|미디어|바이오|창조\s?산업|메이커|스타트업|\bAI\b|\bIT\b|R&D|지식/],
  ["home", /주거|주택|아파트|레지던스|기숙사|살림집/],
  ["biz", /업무|사무|오피스|본사|금융|은행|비즈니스|CBD|기업/],
  ["cult", /문화|미술|박물관|갤러리|공연|극장|예술|공원|전시|콘서트|도서관|교육|대학|유산|역사관|건축관|창작|디자인|음악|스포츠|올림픽|광장|정원|캠퍼스|학교/],
  ["shop", /상업|상점|쇼핑|레스토랑|식당|시장|마켓|호텔|리테일|카페|관광|레저|소매|푸드|맥주|행사 거리/],
  ["ind",  /공장|공업|산업|제철|발전소|창고|사일로|부두|항만|항구|조선|철도|화물|가스|석탄|탱크|저장|정유|도크|하역|양조|증류|도축|제분|방직|섬유|기계|광산|탄광|코크스|정수|변전|용광로|제련|거래소|세관|미곡|곡물|해운|선로|고가|크레인|공업지대|공단|군수|인쇄|맥주 공장|와이너리|물류|차고|정비|기차역|제작|가축|전차|트램/],
];
const useKind = (w, from) => {                         // 원래 용도(A)는 옛 산업 낱말을 먼저 봅니다
  if (from && USE_KIND.find(([k]) => k === "ind")[1].test(w)) return "ind";
  return (USE_KIND.find(([, rx]) => rx.test(w)) || ["etc"])[0];
};
const useParts = (v) => {                              // 괄호 밖의 「 · 」에서만 나눕니다
  const parts = []; let cur = "", depth = 0;
  const str = String(v || "");
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === "(") depth++;
    if (c === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && str.startsWith(" · ", i)) { parts.push(cur); cur = ""; i += 2; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
};
const useHtml = (v, from) => useParts(v).map((w) => `<span class="fl__k fl__k--${useKind(w, from)}">${esc(w)}</span>`).join('<i> · </i>');
/* 용도 구성 버튼 — 변경 용도(B)의 낱말에서 (도시재생은 분류해 둔 종류도 더해서) */
const KINDS = [["tech", "첨단산업"], ["home", "주거"], ["biz", "업무"], ["shop", "상업"], ["cult", "문화"]];
const TYPE_KIND = { "첨단산업형": ["tech"], "주거형": ["home"], "문화 · 복합형": ["cult"] };
const kindsOf = (x) => {
  const k = new Set(useParts(x.to).map((w) => useKind(w)).filter((c) => c !== "etc" && c !== "ind"));
  (x.types || []).forEach((t) => {
    if (t === "업무 · 상업형") { if (!k.has("biz") && !k.has("shop")) k.add("biz"); }
    else (TYPE_KIND[t] || []).forEach((c) => k.add(c));
  });
  return KINDS.map(([c]) => c).filter((c) => k.has(c));
};
const kindChips = (x) => `<span class="fl__chips">${kindsOf(x).map((c) => `<span class="rg__type rg__type--k-${c}">${KINDS.find(([k]) => k === c)[1]}</span>`).join("")}</span>`;
const flow = (a, b) => `<span class="an__tag an__flow"><i>(</i>${useHtml(a, true)}<i>)에서 (</i>${useHtml(b)}<i>)${ro(b)}</i></span>`;
const bullets = (v) => (v || []).length ? `<ul class="rg__ul">${v.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
let RNV = null, RGN = null;
const loadJ = (f) => fetch("assets/data/" + f + "?v=" + V).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] }));

/* ── Architectural Renovation — 원래 용도 → 변경 용도 ── */
const RNONE = (what) => `<p class="rg__none">— ${esc(what)}: 확인된 자료를 찾지 못했습니다. (찾는 대로 보완합니다)</p>`;
function rnvBody(b, arch) {
  const show = gridFor(b);
  const A = arch ? `<p><a href="gallery.html?cat=architects#ar-${esc(arch.id)}" class="ab__arch">${titleHtml(arch)} →</a></p>` : "";
  const st = b.strategy || {};
  return `<div class="an__body">
    <div class="rn__flip"><div><small>원래 용도</small><b>${esc(b.from)}</b><span>${esc(b.y0 || "")}</span></div>
      <i>→</i><div><small>변경 용도</small><b>${esc(b.to)}</b><span>${esc(b.y || "")}</span></div></div>
    <h4>1) 건축가 개요</h4>
    ${A}${paras(b.archAbout)}
    <h4>2) 건축개요 — 원 건축물과 리노베이션</h4>
    ${kvTable(b.spec)}
    ${(b.timeline || []).length ? `<p class="rg__lab">연혁</p><table class="ab__spec rg__tl"><tbody>${b.timeline.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : ""}
    ${(b.heritage || []).length ? `<p class="rg__lab">보호 지정 · 근거 제도</p>${kvTable(b.heritage)}` : ""}
    <h4>3) 리노베이션 컨셉 및 우수한 이유</h4>
    ${show("concept")}
    ${paras(b.concept)}
    ${(st.keep || st.change || st.add) ? `<div class="rn__st">
      ${st.keep ? `<div><b>남긴 것</b>${bullets(st.keep)}</div>` : ""}
      ${st.change ? `<div><b>바꾼 것</b>${bullets(st.change)}</div>` : ""}
      ${st.add ? `<div><b>더한 것</b>${bullets(st.add)}</div>` : ""}</div>` : ""}
    ${b.quote ? `<blockquote class="ab__q">${esc(b.quote)}<small>— 건축가의 설명 (요약 · 번역)</small></blockquote>` : ""}
    <div class="ab__why"><b>우수한 이유</b>${bullets(b.why)}</div>
    <h4>4) 건축물 공간특성 — 평면도 · 입면도 · 단면도</h4>
    ${show("plan", "공개된 도면을 찾지 못했습니다")}
    ${paras(b.space)}
    <h4>5) 건축물 재료 및 구조</h4>
    ${show("build")}
    ${paras(b.material)}
    <h4>6) 재원 및 보조금 — 사업비 · 공공 재원 · 보조금 · 후원</h4>
    ${(b.funding || []).length || (b.fundingNote || []).length ? kvTable(b.funding) + paras(b.fundingNote) : RNONE("재원 · 보조금")}
    <h4>7) 시사점 — 이 사례가 유명한 이유</h4>
    ${(b.famous || []).length ? `<div class="ab__why"><b>이 사례가 유명한 이유</b>${bullets(b.famous)}</div>` : RNONE("유명한 이유")}
    ${(b.lesson || []).length ? `<p class="rg__lab">리노베이션에 주는 교훈</p>${bullets(b.lesson)}` : ""}
    ${(b.missing || []).length ? `<div class="rg__miss"><b>찾지 못한 자료</b>${bullets(b.missing)}</div>` : ""}
    <h4 class="an__refh">References</h4>
    <p class="an__refs an__refs--big">${refsHtml(b.refs)}</p>
  </div>`;
}

export async function drawRenovations(el, qv) {
  el.innerHTML = '<p class="an__wait">리노베이션 노트를 불러오는 중…</p>';
  let d, r;
  try { [d, r] = await Promise.all([load(), RNV || (RNV = loadJ("renovations.json"))]); } catch (e) { el.innerHTML = '<p class="an__wait">불러오지 못했습니다.</p>'; return; }
  const byId = Object.fromEntries(d.items.map((a) => [a.id, a]));
  const q = fold(qv || "").trim();
  const GROUPS = [...new Set((r.items || []).map((x) => x.group).filter(Boolean))];
  let g = "";
  const paint = () => {
    const items = (r.items || []).filter((x) => (!g || x.group === g) &&
      (!q || fold([x.t, x.ko, x.at, x.archName, x.from, x.to].join(" ")).includes(q)));
    el.querySelector("#rnList").innerHTML = items.length ? `<ol class="an__list">${items.map((x) => `
      <li><details class="an" id="rn-${esc(x.id)}" data-id="${esc(x.id)}">
        <summary><span class="an__t">${kindChips(x)} <span class="an__nat">[${esc(x.nat || "")}]</span> <b>${esc(x.ko)}</b>_${esc(x.t)}
          ${flow(x.from, x.to)}
          <span class="an__life">(개조 ${esc(x.y)} · ${esc(x.archName || "")})</span></span></summary>
      </details></li>`).join("")}</ol>` : '<p class="an__wait">찾는 사례가 없습니다.</p>';
    el.querySelectorAll(".an__chips button").forEach((bt) => bt.classList.toggle("on", bt.dataset.g === g));
    const map = Object.fromEntries((r.items || []).map((x) => [x.id, x]));
    popOut(el.querySelector("#rnList"), "renovation");
  };
  el.innerHTML = `<section class="annote">
    <div class="an__head"><h3>건축 리노베이션 노트</h3>
      <p>쓰임을 다한 건축물을 허물지 않고 보존하면서 새 용도로 바꾼 사례 (적응적 재사용 · adaptive reuse) — 원래 용도 → 변경 용도를 맨 위에 밝히고,
         1) 건축가 개요 · 2) 건축개요 · 3) 리노베이션 컨셉(남긴 것 · 바꾼 것 · 더한 것)과 우수한 이유 · 4) 공간특성(도면) · 5) 재료 및 구조 · 6) 재원 및 보조금 · 7) 시사점(유명한 이유)으로 정리했습니다. 제목을 누르면 새 창에서 자세히 봅니다. 최근 개조를 위로.</p>
      <div class="an__chips"><button type="button" data-g="">전체 ${(r.items || []).length}</button>${GROUPS.map((x) =>
        `<button type="button" data-g="${esc(x)}">${esc(x)} ${(r.items || []).filter((y) => y.group === x).length}</button>`).join("")}</div>
    </div><div id="rnList"></div></section>`;
  el.querySelectorAll(".an__chips button").forEach((bt) => bt.addEventListener("click", () => { g = bt.dataset.g; paint(); }));
  paint();
}

/* ── Urban Regeneration — 노후 산업지역의 재생 ── */
function rgnBody(x) {
  /* 사진을 항목마다 나눠 싣기 — 조감 · 전경(맨 위) / 보존 건물(1) 옆) / 지도 · 계획도(5)) / 나머지(6)) */
  const ph = (x.imgs && x.imgs.build) || [], pl = (x.imgs && x.imgs.plan) || [], ae = (x.imgs && x.imgs.concept) || [];
  const fig = (im) => `<figure class="ab__fig"><a href="${esc(im.page)}" target="_blank" rel="noopener"><img src="${esc(im.src)}" alt="${esc(im.cap || "")}" loading="lazy"></a>
      <figcaption>${im.cap ? `<b>${esc(im.cap)}</b> · ` : ""}${esc(im.artist || "")} · ${esc(im.license || "")} · Wikimedia Commons</figcaption></figure>`;
  const row = (list) => list.length ? `<div class="ab__figs">${list.map(fig).join("")}</div>` : "";
  const NONE = (what) => `<p class="rg__none">${esc(what)} — 확인된 자료를 찾지 못했습니다. (찾는 대로 보완합니다)</p>`;
  const sec = (rows, note, what) => (rows && rows.length) || (note && note.length) ? kvTable(rows) + paras(note) : NONE(what);
  return `<div class="an__body">
    <div class="rn__flip"><div><small>원래 용도 · 용도지구</small><b>${esc(x.from)}</b><span>${esc(x.zoneFrom || "")}</span></div>
      <i>→</i><div><small>변경 용도 · 용도지구</small><b>${esc(x.to)}</b><span>${esc(x.zoneTo || "")}</span></div></div>
    ${row(ae.concat(ph.slice(0, 1)).slice(0, 3))}
    ${(x.keep || []).length ? `<div class="rg__keep"><b>보존 · 활용한 옛 건물</b>${bullets(x.keep)}</div>` : ""}
    <h4>1) 개발개요 — 원래 용도 · 변경 용도 · 문제점과 개발 이유</h4>
    ${kvTable(x.spec)}
    ${(x.timeline || []).length ? `<p class="rg__lab">연혁</p><table class="ab__spec rg__tl"><tbody>${x.timeline.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : ""}
    <p class="rg__lab">문제점 및 개발 이유</p>${(x.problem || []).length ? bullets(x.problem) : NONE("문제점 · 개발 이유")}
    ${paras(x.overview)}
    ${row(ph.slice(1, 4))}
    <h4>2) 개발주체 — 기관 · 관련 기관 · 전문가 단체 · 시민단체</h4>
    ${sec(x.actors, x.actorsNote, "개발주체")}
    <h4>3) 개발 근거법 및 규제완화</h4>
    ${sec(x.laws, x.lawsNote, "근거법 · 규제완화")}
    <h4>4) 지구지정 및 관리</h4>
    ${gridFor(x)("plan")}
    ${sec(x.zoning, x.zoningNote, "지구지정 · 관리")}
    <h4>5) 개발수단 — 용적률 완화 · 용도변경 · 재원 · 인센티브</h4>
    ${sec(x.tools, x.toolsNote, "개발수단")}
    <h4>6) 재원 및 보조금 — 사업비 · 공공 재원 · 보조금 · 지원금</h4>
    ${sec(x.funding, x.fundingNote, "재원 · 보조금")}
    <h4>7) 시사점 — 이 사례가 유명한 이유 · 성과 · 교훈</h4>
    ${(x.famous || []).length ? `<div class="ab__why"><b>이 사례가 유명한 이유</b>${bullets(x.famous)}</div>` : NONE("유명한 이유")}
    ${x.result ? `<p class="rg__lab">성과</p>${bullets(x.result)}` : ""}
    ${x.lesson ? `<p class="rg__lab">노후 산업단지 재생에 주는 교훈</p>${bullets(x.lesson)}` : ""}
    ${row(ph.slice(4))}
    ${(x.missing || []).length ? `<div class="rg__miss"><b>찾지 못한 자료</b>${bullets(x.missing)}</div>` : ""}
    <h4 class="an__refh">References</h4>
    <p class="an__refs an__refs--big">${refsHtml(x.refs)}</p>
  </div>`;
}

export async function drawRegenerations(el, qv) {
  el.innerHTML = '<p class="an__wait">도시재생 노트를 불러오는 중…</p>';
  let r;
  try { r = await (RGN || (RGN = loadJ("regenerations.json"))); } catch (e) { el.innerHTML = '<p class="an__wait">불러오지 못했습니다.</p>'; return; }
  const q = fold(qv || "").trim();
  (r.items || []).forEach((x) => { x._k = kindsOf(x); });
  let g = "";
  const paint = () => {
    const items = (r.items || []).filter((x) => (!g || x._k.includes(g)) &&
      (!q || fold([x.t, x.ko, x.city, x.nat, x.from, x.to].join(" ")).includes(q)));
    el.querySelector("#rgList").innerHTML = items.length ? `<ol class="an__list">${items.map((x) => `
      <li><details class="an" id="rg-${esc(x.id)}" data-id="${esc(x.id)}">
        <summary><span class="an__t">${kindChips(x)} <span class="an__nat">[${esc(x.nat || "")}]</span> <b>${esc(x.ko)}</b>_${esc(x.t)}
          ${flow(x.from, x.to)}
          <span class="an__life">(${esc(x.period || "")})</span></span></summary>
      </details></li>`).join("")}</ol>` : '<p class="an__wait">찾는 사례가 없습니다.</p>';
    el.querySelectorAll(".an__chips button").forEach((bt) => bt.classList.toggle("on", bt.dataset.g === g));
    const map = Object.fromEntries((r.items || []).map((x) => [x.id, x]));
    popOut(el.querySelector("#rgList"), "regeneration");
  };
  el.innerHTML = `<section class="annote">
    <div class="an__head"><h3>도시재생 노트 — 노후 산업지역은 어떻게 바뀌었나</h3>
      <p>쇠퇴한 공업지역 · 항만 · 철도 부지가 ① 첨단산업 ② 주거 ③ 업무 · 상업으로 바뀐 사례 — 모두 철거하지 않고 <b>옛 건물 일부를 보존 · 활용한 사례</b>만 모았습니다. 원래 용도(지구) → 변경 용도(지구)를 맨 위에 밝히고,
         1) 개발개요 · 2) 개발주체 · 3) 근거법 및 규제완화 · 4) 지구지정 및 관리 · 5) 개발수단 · 6) 재원 및 보조금 · 7) 시사점(유명한 이유 · 성과 · 교훈)으로 정리했습니다. 제목을 누르면 새 창에서 자세히 봅니다. 최근 사업을 위로.</p>
      <div class="an__chips"><button type="button" data-g="">전체 ${(r.items || []).length}</button>${KINDS.map(([c, t]) =>
        `<button type="button" class="rg__chip rg__type--k-${c}" data-g="${c}">${t} ${(r.items || []).filter((y) => y._k.includes(c)).length}</button>`).join("")}</div>
    </div><div id="rgList"></div></section>`;
  el.querySelectorAll(".an__chips button").forEach((bt) => bt.addEventListener("click", () => { g = bt.dataset.g; paint(); }));
  paint();
}


/* ── 제목을 누르면 새 창(note.html)에서 사례 하나를 자세히 ── */
function popOut(list, kind) {
  if (!list) return;
  list.querySelectorAll("details.an > summary").forEach((sm) => {
    sm.title = "새 창에서 자세히 보기";
    sm.addEventListener("click", (e) => {
      e.preventDefault();
      const id = sm.parentElement.dataset.id;
      window.open(`note.html?k=${kind}&id=${encodeURIComponent(id)}`, "_blank", "noopener");
    });
  });
}

/* note.html — 사례 하나 (kind: renovation · regeneration) */
export async function drawNote(el, kind, id) {
  el.innerHTML = '<p class="an__wait">불러오는 중…</p>';
  try {
    if (kind === "renovation") {
      const [d, r] = await Promise.all([load(), RNV || (RNV = loadJ("renovations.json"))]);
      const x = (r.items || []).find((y) => y.id === id);
      if (!x) throw 0;
      const arch = d.items.find((a) => a.id === x.arch);
      document.title = `${x.ko} — Architectural Renovation`;
      el.innerHTML = `<section class="annote an--page"><p class="an__crumb"><a href="gallery.html?cat=renovation">← Architectural Renovation</a></p>
        <h2 class="an__ptitle">${kindChips(x)} <span class="an__nat">[${esc(x.nat || "")}]</span> <b>${esc(x.ko)}</b>_${esc(x.t)}<br>${flow(x.from, x.to)}
        <span class="an__life">(개조 ${esc(x.y)} · ${esc(x.archName || "")})</span></h2>
        <div class="an" data-id="${esc(x.id)}">${rnvBody(x, arch)}</div></section>`;
    } else {
      const r = await (RGN || (RGN = loadJ("regenerations.json")));
      const x = (r.items || []).find((y) => y.id === id);
      if (!x) throw 0;
      document.title = `${x.ko} — Urban Regeneration`;
      el.innerHTML = `<section class="annote an--page"><p class="an__crumb"><a href="gallery.html?cat=regeneration">← Urban Regeneration</a></p>
        <h2 class="an__ptitle">${kindChips(x)} <span class="an__nat">[${esc(x.nat || "")}]</span> <b>${esc(x.ko)}</b>_${esc(x.t)}<br>${flow(x.from, x.to)} <span class="an__life">(${esc(x.period || "")})</span></h2>
        <div class="an" data-id="${esc(x.id)}">${rgnBody(x)}</div></section>`;
    }
    decorate(el.querySelector(".an"), kind, id);
  } catch (e) {
    el.innerHTML = '<p class="an__wait">사례를 찾지 못했습니다.</p>';
  }
}
