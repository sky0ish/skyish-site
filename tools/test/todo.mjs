// ─── 해야할일 차례 셈 시험 ─────────────────────────────────
//
//   돌리는 법 :  node tools/test/todo.mjs   (node 가 없으면 _todotest.html 을 로컬 서버로)
//
// 「완료되면 줄그어서 아래로, 중요한 건 별표로 위로, 항목별로 기입·삭제·편집」

import { sortItems, counts, dueState, dueLabel, newItem, patchFor, todayTitle, ymd }
  from "../../assets/js/todo-list.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};
const T = "2026-09-10";
const it = (id, o) => Object.assign({ id, text: id, done: false, star: false, due: null,
                                      done_at: null, created_at: "2026-09-01T00:00:00Z" }, o || {});

console.log("\n── 차례 ──");
const L = [
  it("보통1", { created_at: "2026-09-01T01:00:00Z" }),
  it("완료A", { done: true, done_at: "2026-09-09T10:00:00Z" }),
  it("별표",  { star: true, created_at: "2026-09-05T00:00:00Z" }),
  it("보통2", { created_at: "2026-09-01T02:00:00Z" }),
  it("완료B", { done: true, done_at: "2026-09-10T10:00:00Z" }),
  it("마감오늘", { due: T, created_at: "2026-09-09T00:00:00Z" }),
];
eq("★ 별표 → 보통(마감 가까운 것 먼저) → 완료(방금 끝낸 것부터)",
   sortItems(L, T).map((x) => x.id), ["별표", "마감오늘", "보통1", "보통2", "완료B", "완료A"]);
eq("별표가 둘이면 먼저 적은 것", sortItems([it("b", { star: true, created_at: "2026-09-02T00:00:00Z" }),
   it("a", { star: true, created_at: "2026-09-01T00:00:00Z" })]).map((x) => x.id), ["a", "b"]);
eq("완료한 별표도 아래로", sortItems([it("x", { star: true, done: true }), it("y")]).map((x) => x.id), ["y", "x"]);
eq("원본을 안 건드린다", L[0].id, "보통1");
eq("험한 것", [sortItems(null), sortItems([null, {}])], [[], []]);

console.log("\n── 마감 ──");
eq("지남·오늘·사흘 안·나중·없음",
   [dueState({ due: "2026-09-09" }, T), dueState({ due: T }, T), dueState({ due: "2026-09-12" }, T),
    dueState({ due: "2026-10-01" }, T), dueState({ due: null }, T), dueState({ due: "이상함" }, T)],
   ["late", "today", "soon", "later", "", ""]);
eq("사람 말로", [dueLabel({ due: T }, T), dueLabel({ due: "2026-09-08" }, T), dueLabel({ due: "2026-09-12" }, T), dueLabel({}, T)],
   ["오늘", "지남 · 9.8(화)", "9.12(토)", ""]);
eq("제목", todayTitle(T), "9월 10일(목) 해야할일");
eq("ymd", ymd(new Date(2026, 8, 10)), "2026-09-10");

console.log("\n── 셈 ──");
eq("남은·완료·별표·오늘까지", counts(L, T), { total: 6, open: 4, done: 2, star: 1, today: 1 });
eq("지난 것도 오늘까지로 센다", counts([it("a", { due: "2026-09-01" })], T).today, 1);
eq("빈 것", counts([], T), { total: 0, open: 0, done: 0, star: 0, today: 0 });

console.log("\n── 적기·고치기 ──");
eq("새 줄", newItem("  보고서   쓰기 ", "2026-09-12", "now"),
   { text: "보고서 쓰기", due: "2026-09-12", done: false, star: false, done_at: null, created_at: "now" });
eq("빈 글은 안 만든다", [newItem("   "), newItem(null)], [null, null]);
eq("마감이 이상하면 비운다", newItem("가", "언젠가").due, null);
eq("300자에서 자른다", newItem("가".repeat(400)).text.length, 300);
const base = it("a", { text: "가" });
eq("완료 켜기 → done_at", patchFor(base, { done: true }, "T1"), { done: true, done_at: "T1" });
eq("완료 끄기 → done_at 비움", patchFor(it("a", { done: true, done_at: "T0" }), { done: false }), { done: false, done_at: null });
eq("별표", patchFor(base, { star: true }), { star: true });
eq("같은 값이면 빈 것", [patchFor(base, { star: false }), patchFor(base, { done: false }), patchFor(base, { text: "가" })], [{}, {}, {}]);
eq("빈 글로는 못 고친다", patchFor(base, { text: "   " }), {});
eq("글 고치기", patchFor(base, { text: " 나  다 " }), { text: "나 다" });
eq("마감 넣고 빼기", [patchFor(base, { due: "2026-09-12" }), patchFor(it("a", { due: "2026-09-12" }), { due: "" })],
   [{ due: "2026-09-12" }, { due: null }]);
eq("험한 것", [patchFor(null, { done: true }), patchFor(base, null)], [{}, {}]);

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
globalThis.__testBad = bad;
if (typeof process !== "undefined" && process.exit) process.exit(bad ? 1 : 0);
