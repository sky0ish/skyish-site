// ─── 사람들 — 관계망 셈 ────────────────────────────────────
//
//  「사람들」 화면의 관계망 그림에 쓰는 셈입니다.
//
//    · 점 하나  = 사람.   크기는 만난 횟수.  글자는 안 답니다.
//    · 글자 점  = 기관(주황) · 행사 주제(분홍).
//    · 선       = 함께 등장한 사이.  두께는 함께한 횟수.
//        사람─사람  같은 자리에서 만난 횟수
//        사람─기관  그 소속으로 적힌 만남 횟수
//        사람─주제  그 낱말이 든 자리에 있던 횟수
//
//  여기에는 화면이 없습니다 — 그래프를 만들고, 자리를 잡을 뿐입니다.
//  그리기는 notes.js 가 캔버스에 합니다.
//  그래서 node 로 곧바로 시험할 수 있습니다 (tools/test/network.mjs).

import * as ST from "./notes-stats.js?v=202609012100";

/* ── 그래프 만들기 ───────────────────────────────────────── */

/**
 * 글 목록에서 점(node)과 선(edge)을 뽑습니다.
 * @param rows   글 목록
 * @param opts   { people, orgs, topics }  각각 몇 개까지 담을지
 * @returns { nodes:[{id,type,label,n,size}], edges:[{a,b,w}] }
 *          type: "who" | "org" | "topic"
 */
export function buildGraph(rows, opts) {
  /* 글자 점(기관·주제)이 많으면 이름끼리 뭉개집니다 — 12개씩만 */
  const o = { people: 60, orgs: 12, topics: 12, ...(opts || {}) };

  const ppl = ST.byPerson(rows).slice(0, o.people);
  const keep = new Set(ppl.map((p) => p.key));

  const orgs = ST.wordsOrg(rows, o.orgs);
  const topics = ST.wordsEvent(rows, o.topics)
    // 기관과 같은 말이 주제로도 잡히면 기관 쪽만 남깁니다
    .filter((t) => !orgs.some((g) => g.word === t.word));

  const nodes = [];
  const idOf = new Map();                      // "who:이소라" → 번호
  const add = (type, label, n, org) => {
    const key = type + ":" + label;
    if (idOf.has(key)) return idOf.get(key);
    const id = nodes.length;
    idOf.set(key, id);
    nodes.push({ id, type, label, n, org: org || "" });
    return id;
  };

  // 소속을 실어 둡니다 — 점을 눌렀을 때 이름과 함께 보여 주려고
  ppl.forEach((p) => add("who", p.key, p.meets.length, p.org));
  orgs.forEach((g) => add("org", g.word, g.n));
  topics.forEach((t) => add("topic", t.word, t.n));

  /* 선 — 같은 글에 함께 나온 만큼 굵어집니다 */
  const wEdge = new Map();                     // "3|7" → 무게
  const tie = (a, b, w) => {
    if (a === b || a < 0 || b < 0) return;
    const k = a < b ? a + "|" + b : b + "|" + a;
    wEdge.set(k, (wEdge.get(k) || 0) + (w || 1));
  };
  const whoId = (name) => idOf.has("who:" + name) ? idOf.get("who:" + name) : -1;

  rows.forEach((r) => {
    const who = ST.peopleOf(r).map((one) => ST.splitPerson(one))
      .filter((p) => keep.has(p.name));
    const ids = who.map((p) => whoId(p.name));

    // 사람 ─ 사람 : 같은 자리
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) tie(ids[i], ids[j], 1);

    // 사람 ─ 기관 : 괄호 속 소속
    who.forEach((p, i) => {
      if (!p.org) return;
      p.org.split(/\s*[,/·]\s*/).forEach((one) => {
        const g = idOf.get("org:" + one.trim());
        if (g != null) tie(ids[i], g, 1);
      });
    });

    // 사람 ─ 주제 : 그 낱말이 든 자리에 함께 있었다
    const hay = [r.event, r.tag, r.title].filter(Boolean).join(" ");
    topics.forEach((t) => {
      if (!hay.includes(t.word)) return;
      const tid = idOf.get("topic:" + t.word);
      ids.forEach((i) => tie(i, tid, 1));
    });

    // 기관 ─ 주제 : 행사 글에 함께 적힌 기관과 낱말
    orgs.forEach((g) => {
      if (!hay.includes(g.word)) return;
      const gid = idOf.get("org:" + g.word);
      topics.forEach((t) => {
        if (hay.includes(t.word)) tie(gid, idOf.get("topic:" + t.word), 1);
      });
    });
  });

  const edges = [...wEdge.entries()].map(([k, w]) => {
    const [a, b] = k.split("|").map(Number);
    return { a, b, w };
  });

  /* 아무와도 이어지지 않은 점은 뺍니다 — 구석에 먼지처럼 남습니다 */
  const linked = new Set();
  edges.forEach((e) => { linked.add(e.a); linked.add(e.b); });
  const alive = nodes.filter((n) => linked.has(n.id));
  const renum = new Map(alive.map((n, i) => [n.id, i]));
  alive.forEach((n, i) => { n.id = i; });
  const eAlive = edges.map((e) => ({ a: renum.get(e.a), b: renum.get(e.b), w: e.w }));

  /* 점 크기 — 제곱근 눈금. 1번과 30번이 30배 차이 나면 그림이 무너집니다 */
  const hi = Math.max(1, ...alive.map((n) => n.n));
  alive.forEach((n) => {
    const t = Math.sqrt(n.n / hi);
    n.size = (n.type === "who" ? 3.5 + t * 12 : 5 + t * 13);
  });

  return { nodes: alive, edges: eAlive };
}

/* ── 자리 잡기 (힘-배치) ─────────────────────────────────── */

/** 늘 같은 그림이 나오도록, 시각이 아니라 씨앗에서 뽑는 난수 */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 점들의 자리를 잡습니다.
 * @returns nodes 각각에 x·y 를 채워 돌려줍니다 (0~w, 0~h 안)
 */
export function layout(graph, w, h, iters = 340) {
  const N = graph.nodes.length;
  if (!N) return graph;
  const rand = rng(42);
  const cx = w / 2, cy = h / 2;

  // 처음에는 가운데 둘레에 흩어 놓습니다
  graph.nodes.forEach((n, i) => {
    const a = (i / N) * Math.PI * 2;
    const r = Math.min(w, h) * (0.18 + rand() * 0.22);
    n.x = cx + Math.cos(a) * r + (rand() - 0.5) * 20;
    n.y = cy + Math.sin(a) * r + (rand() - 0.5) * 20;
    n.vx = 0; n.vy = 0;
  });

  const K = Math.sqrt((w * h) / N) * 1.05;     // 알맞은 사이 거리 — 글자 자리까지 셈
  const maxW = Math.max(1, ...graph.edges.map((e) => e.w));

  for (let it = 0; it < iters; it++) {
    const cool = 1 - it / iters;               // 갈수록 식어 갑니다
    const step = 6 * cool + 0.4;

    // 서로 밀기
    for (let i = 0; i < N; i++) {
      const a = graph.nodes[i];
      for (let j = i + 1; j < N; j++) {
        const b = graph.nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = rand() - 0.5; dy = rand() - 0.5; d2 = 0.5; }
        const d = Math.sqrt(d2);
        /* 글자 달린 점(기관·주제)끼리는 더 세게 밉니다 — 이름이 포개지지 않게 */
        const both = a.type !== "who" && b.type !== "who";
        const push = (K * K) / d2 * (both ? 2.1 : 0.9);
        dx /= d; dy /= d;
        a.vx += dx * push; a.vy += dy * push;
        b.vx -= dx * push; b.vy -= dy * push;
      }
    }
    // 이어진 사이는 당기기 — 굵은 선일수록 세게
    graph.edges.forEach((e) => {
      const a = graph.nodes[e.a], b = graph.nodes[e.b];
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = (d - K * 0.8) / K * (0.4 + 0.6 * (e.w / maxW)) * 0.06 * d;
      dx /= d; dy /= d;
      a.vx += dx * pull; a.vy += dy * pull;
      b.vx -= dx * pull; b.vy -= dy * pull;
    });
    // 가운데로 살짝
    graph.nodes.forEach((n) => {
      n.vx += (cx - n.x) * 0.006;
      n.vy += (cy - n.y) * 0.006;
      const v = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 1;
      const cap = Math.min(v, step);
      n.x += n.vx / v * cap;
      n.y += n.vy / v * cap;
      n.vx *= 0.5; n.vy *= 0.5;
    });
  }

  // 틀 안으로 — 글자 자리를 남겨 두고 가둡니다
  const pad = 26;
  graph.nodes.forEach((n) => {
    n.x = Math.max(pad, Math.min(w - pad, n.x));
    n.y = Math.max(pad, Math.min(h - pad, n.y));
    delete n.vx; delete n.vy;
  });
  return graph;
}
