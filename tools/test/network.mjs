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
ok("행사 주제 점이 있다", !!by("topic", "토론회"),
   "주제: " + g.nodes.filter((n) => n.type === "topic").map((n) => n.label).join(", "));
ok("연구 주제 점이 있다", !!by("theme", "도시재생"),
   "연구 주제: " + g.nodes.filter((n) => n.type === "theme").map((n) => n.label).join(", "));
ok("연구 주제로 잡힌 말은 행사 주제에서 뺀다", !by("topic", "도시재생"));
ok("기관과 겹치는 주제는 뺀다", !by("topic", "국토연구원"));

const 이 = by("who", "이소라"), 김 = by("who", "김철수"), 박 = by("who", "박진우");
ok("함께 두 번 만난 사이는 무게 2", edge(이, 김) && edge(이, 김).w === 2,
   edge(이, 김) && "무게 " + edge(이, 김).w);
ok("한 번 만난 사이는 무게 1", edge(박, 이) && edge(박, 이).w === 1);
ok("사람─기관 선", !!edge(이, by("org", "국토연구원")));
ok("사람─연구 주제 선 (도시재생 자리에 두 번)",
   edge(김, by("theme", "도시재생")) && edge(김, by("theme", "도시재생")).w === 2);
ok("기관─연구 주제 선", !!edge(by("org", "국토연구원"), by("theme", "도시재생")));
ok("만난 사람 없는 글은 흔적이 없다", g.nodes.every((n) => n.label !== "혼자"));
ok("점 크기가 잦기를 따른다", by("who", "이소라").size > by("who", "최영희").size);
ok("모든 선이 살아 있는 점을 가리킨다",
   g.edges.every((e) => g.nodes[e.a] && g.nodes[e.b]));

console.log("[연구 주제 — 본문에 적어도 잡힙니다]");
{
  const gb = buildGraph([
    { id: "x", event_date: "2026-08-25", title: "이천 방문",
      body: "청미천에서 드론을 띄워 보았다. 빈집 정비 이야기도 나왔다.",
      people: "이석준 (이천시청), 강한구" },
    { id: "y", event_date: "2026-08-26", title: "회의",
      body: "K-컬처 거점 조성과 방위산업 클러스터를 함께 논의.",
      people: "이석준 (이천시청)" },
  ]);
  const t = (l) => gb.nodes.find((n) => n.type === "theme" && n.label === l);
  ok("본문의 「드론」을 찾는다", !!t("드론"));
  ok("본문의 「빈집」을 찾는다", !!t("빈집"));
  ok("「K-컬처」를 K컬처로 모은다", !!t("K컬처"));
  ok("「방위산업」을 방산으로 모은다", !!t("방산"));
  ok("두 번 나온 사람과 주제가 이어진다",
     !!gb.edges.find((e) => {
       const a = gb.nodes[e.a], b = gb.nodes[e.b];
       return (a.label === "이석준" && b.label === "드론") ||
              (b.label === "이석준" && a.label === "드론");
     }));
}

console.log("[동경대 동문]");
{
  const ga = buildGraph(rows, { alumni: new Set(["이소라", "최영희", "명부에만있는분"]) });
  const alma = ga.nodes.find((n) => n.type === "alma");
  const by2 = (t, l) => ga.nodes.find((n) => n.type === t && n.label === l);
  const e2 = (p, q2) => ga.edges.find((e) =>
    (e.a === p.id && e.b === q2.id) || (e.a === q2.id && e.b === p.id));
  ok("동경대 점이 생긴다", !!alma && alma.label === "동경대");
  ok("맞은 사람 수를 센다", alma && alma.n === 2, alma && "n=" + alma.n);
  ok("동문과 이어진다", !!e2(by2("who", "이소라"), alma));
  ok("선 두께 = 그분과 만난 횟수", e2(by2("who", "이소라"), alma).w === 2);   // a·b 두 자리
  ok("명부에만 있고 만난 적 없는 분은 점이 없다",
     !ga.nodes.some((n) => n.label === "명부에만있는분"));
  ok("명부 없이는 동경대 점도 없다",
     !buildGraph(rows).nodes.some((n) => n.type === "alma"));
}

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
