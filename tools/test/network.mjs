// ─── 관계망 셈 시험 ────────────────────────────────────────
//
//   돌리는 법 :  node tools/test/network.mjs

import { buildGraph, layout, rng } from "../../assets/js/notes-network.js";

let bad = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + (extra ? "\n      " + extra : ""));
};

const rows = [
  { id: "a", event_date: "2026-08-28", tag: "토론", event: "지방자치 토론회",
    title: "자치행정", people: "박진우 (수원시정연구원), 이소라 (국토연구원), 김철수" },
  { id: "b", event_date: "2026-07-14", tag: "발표", event: "도시재생 학술대회",
    title: "논문발표", people: "이소라 (국토연구원), 김철수 (경기연구원)" },
  { id: "c", event_date: "2026-06-03", tag: "자문회의", event: "도시재생 자문회의",
    title: "자문", people: "김철수, 최영희" },
  { id: "d", event_date: "2026-05-01", title: "혼자 메모", people: "" },
];

console.log("\n── 그래프 만들기 ──");
const g = buildGraph(rows);
const by = (t, l) => g.nodes.find((n) => n.type === t && n.label === l);
const edge = (p, q) => g.edges.find((e) =>
  (e.a === p.id && e.b === q.id) || (e.a === q.id && e.b === p.id));

ok("사람 점이 있다", !!by("who", "이소라") && !!by("who", "김철수"));
ok("기관 점이 있다", !!by("org", "국토연구원") && !!by("org", "경기연구원"));
ok("주제 점이 있다", !!by("topic", "도시재생"),
   "주제: " + g.nodes.filter((n) => n.type === "topic").map((n) => n.label).join(", "));
ok("기관과 겹치는 주제는 뺀다", !by("topic", "국토연구원"));

const 이 = by("who", "이소라"), 김 = by("who", "김철수"), 박 = by("who", "박진우");
ok("함께 두 번 만난 사이는 무게 2", edge(이, 김) && edge(이, 김).w === 2,
   edge(이, 김) && "무게 " + edge(이, 김).w);
ok("한 번 만난 사이는 무게 1", edge(박, 이) && edge(박, 이).w === 1);
ok("사람─기관 선", !!edge(이, by("org", "국토연구원")));
ok("사람─주제 선 (도시재생 자리에 두 번)",
   edge(김, by("topic", "도시재생")) && edge(김, by("topic", "도시재생")).w === 2);
ok("만난 사람 없는 글은 흔적이 없다", g.nodes.every((n) => n.label !== "혼자"));
ok("점 크기가 잦기를 따른다", by("who", "이소라").size > by("who", "최영희").size);
ok("모든 선이 살아 있는 점을 가리킨다",
   g.edges.every((e) => g.nodes[e.a] && g.nodes[e.b]));

console.log("\n── 자리 잡기 ──");
const W = 900, H = 520;
layout(g, W, H);
ok("모든 점에 자리가 있다", g.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)));
ok("틀 안에 있다", g.nodes.every((n) => n.x >= 0 && n.x <= W && n.y >= 0 && n.y <= H));
{
  // 같은 씨앗이면 같은 그림 — 새로고침마다 그림이 널뛰면 못 씁니다
  const g2 = layout(buildGraph(rows), W, H);
  ok("두 번 그려도 같은 자리", g.nodes.every((n, i) =>
    Math.abs(n.x - g2.nodes[i].x) < 1e-9 && Math.abs(n.y - g2.nodes[i].y) < 1e-9));
}
{
  // 서로 겹쳐 붙어 버리지 않았는지 — 가장 가까운 두 점 사이
  let min = 1e9;
  for (let i = 0; i < g.nodes.length; i++)
    for (let j = i + 1; j < g.nodes.length; j++) {
      const dx = g.nodes[i].x - g.nodes[j].x, dy = g.nodes[i].y - g.nodes[j].y;
      min = Math.min(min, Math.sqrt(dx * dx + dy * dy));
    }
  ok("점들이 뭉개지지 않았다 (사이 " + min.toFixed(1) + "px)", min > 12);
}

console.log("\n── 씨앗 난수 ──");
{
  const a = rng(7), b = rng(7);
  ok("같은 씨앗은 같은 열", a() === b() && a() === b());
  const c = rng(7);
  let inRange = true;
  for (let i = 0; i < 1000; i++) { const v = c(); if (v < 0 || v >= 1) inRange = false; }
  ok("0 이상 1 미만", inRange);
}

console.log("\n" + "─".repeat(60));
console.log(bad ? bad + "개가 어긋납니다" : "모두 지나갔습니다");
process.exit(bad ? 1 : 0);
