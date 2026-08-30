// ─── 달력 겹침 걷어내기 시험 ────────────────────────────────
//
//   돌리는 법 :  node tools/test/cal-merge.mjs
//
// 「스케쥴에 글 하나를 올렸는데 달력에 두 개가 뜬다」 를 막는 셈입니다.
//
// 무엇보다 중요한 것 — **구글에만 있는 진짜 약속은 절대 지우면 안 됩니다.**
// 없는 겹침이 남는 것보다, 있는 약속이 사라지는 쪽이 훨씬 큰일입니다.
// 그래서 이 시험은 「안 걷는 경우」 를 「걷는 경우」 보다 더 많이 봅니다.

import { dropMirrors, norm } from "../../assets/js/cal-merge.js";

let bad = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + a + "\n      바란 값: " + b);
};
const titles = (list) => list.map((e) => e.title);

const D = "2026-08-31";
const N = (title, opt) => ({ title, event_date: D, ...(opt || {}) });
const G = (title, opt) => ({ title, date: D, ...(opt || {}) });

console.log("\n── 다듬기 ──");
eq("사이 띄개·점·괄호를 텁니다", norm("[C.U.E] 모임 및 자문회의"), "cue모임및자문회의");
eq("빈 값도 견딥니다", norm(null), "");

console.log("\n── ⓪ 구글 일정 번호로 짝짓기 ──");
{
  const notes = [N("모임", { gcal_id: "abc123" })];
  eq("번호가 같으면 걷습니다",
     titles(dropMirrors(notes, [G("모임", { gid: "abc123" })])), []);
  eq("구글에서 이름을 바꿔도 따라갑니다",
     titles(dropMirrors(notes, [G("아주 다른 이름", { gid: "abc123" })])), []);
  eq("구글에서 날을 옮겨도 따라갑니다",
     titles(dropMirrors(notes, [{ title: "모임", date: "2026-09-15", gid: "abc123" }])), []);
  eq("번호가 다르면 그대로",
     titles(dropMirrors(notes, [G("딴 일", { gid: "zzz999" })])), ["딴 일"]);
  eq("한 글은 한 번만 짝짓습니다",
     titles(dropMirrors(notes, [G("가", { gid: "abc123" }), G("나", { gid: "abc123" })])),
     ["나"]);
}

console.log("\n── ① 같은 날, 제목이 글자 그대로 같을 때 ──");
{
  // 구글로 보낼 때 말머리를 앞에 붙입니다 — 글에는 없는 「[GRI행사]」 가 붙어 옵니다
  eq("말머리가 붙어도 같은 글로 봅니다",
     titles(dropMirrors([N("2026.08.31 (월) 경기강원 초광역 D", { tag: "GRI행사" })],
                        [G("[GRI행사] 2026.08.31 (월) 경기강원 초광역 D")])), []);
  eq("말머리 없이 그대로 넘어간 것도",
     titles(dropMirrors([N("점심 약속")], [G("점심 약속")])), []);
  eq("점·띄개만 다른 것도 같은 글로",
     titles(dropMirrors([N("C.U.E 모임")], [G("CUE 모임")])), []);
  eq("날이 다르면 안 엮습니다",
     titles(dropMirrors([N("점심 약속")], [{ title: "점심 약속", date: "2026-09-01" }])),
     ["점심 약속"]);
}

console.log("\n── ★ 구글에만 있는 진짜 약속은 지킵니다 ──");
{
  // 예전에 「같은 시각이면 같은 일」 로 보다가 이런 것들을 지웠습니다
  eq("같은 날 같은 시각이어도 이름이 다르면 그대로",
     titles(dropMirrors([N("치과", { event_time: "10:00" })],
                        [G("아이 학교 상담", { time: "10:00" })])), ["아이 학교 상담"]);
  eq("같은 시각 여럿이 몰려도 다 남습니다",
     titles(dropMirrors([N("원고 마감", { event_time: "09:00" }), N("운동", { event_time: "09:00" })],
                        [G("건강검진", { time: "09:00" }), G("본부 정기 보고", { time: "09:00" }),
                         G("출장 출발", { time: "09:00" })])),
     ["건강검진", "본부 정기 보고", "출장 출발"]);

  // 앞머리만 같은 서로 다른 일도 지웠습니다
  const 앞머리 = [
    ["이사회", "이사회의실 예약"],
    ["논문 심사", "논문 심사위원 회의"],
    ["학회 발표", "학회 발표자 사전 미팅"],
    ["정기 검진", "정기 검진 결과 상담"],
    ["출장 정산", "출장 정산 서류 제출"],
    ["세종 답사", "국토부 세종 답사 및 회의"],
  ];
  앞머리.forEach(([mine, theirs]) => {
    eq("「" + mine + "」 가 「" + theirs + "」 를 먹지 않습니다",
       titles(dropMirrors([N(mine)], [G(theirs)])), [theirs]);
  });

  eq("내 글이 아예 없으면 다 남습니다",
     titles(dropMirrors([], [G("이천"), G("세종")])), ["이천", "세종"]);
  eq("일기에 적은 메모가 구글 일정을 먹지 않습니다",
     titles(dropMirrors([N("오늘 하루", { category: "diary", event_time: "14:00" })],
                        [G("팀 회의", { time: "14:00" })])), ["팀 회의"]);
}

console.log("\n── 여럿이 섞였을 때 (실제 화면과 같은 꼴) ──");
{
  const notes = [
    N("2026.08.31 (월) 경기강원 초광역 D", { tag: "GRI행사", event_time: "08:00" }),
    N("[C.U.E] 모임 및 자문회의", { event_time: "08:00", gcal_id: "cue-1" }),
    N("(김진령주무관) 국토부(세종) 훼손지 답사", { event_time: "08:00" }),
  ];
  const g = [
    G("[GRI행사] 2026.08.31 (월) 경기강원 초광역 D", { time: "08:00" }),  // ① 제목이 같다
    G("[C.U.E] 모임 및 자문회의", { time: "08:00", gid: "cue-1" }),        // ⓪ 번호가 같다
    G("세종.훼손지", { time: "08:00" }),                                    // 손으로 따로 적은 것
    G("치과", { time: "19:00" }),                                          // 구글에만 있는 일정
  ];
  eq("확실한 둘만 걷고 나머지는 남깁니다",
     titles(dropMirrors(notes, g)), ["세종.훼손지", "치과"]);
  eq("들어온 차례는 그대로",
     dropMirrors(notes, [g[3], g[0], g[2]]).map((e) => e.title), ["치과", "세종.훼손지"]);
}

console.log("\n── 험한 값 ──");
{
  eq("구글이 비면 빈 배열", dropMirrors([N("가")], []), []);
  eq("둘 다 없어도 안 터집니다", dropMirrors(null, null), []);
  eq("날짜 없는 글은 제목으로도 안 엮습니다",
     titles(dropMirrors([{ title: "점심 약속" }], [G("점심 약속")])), ["점심 약속"]);
  eq("번호만 있고 날짜가 없어도 짝지어집니다",
     titles(dropMirrors([{ title: "가", gcal_id: "x1" }], [G("나", { gid: "x1" })])), []);
  eq("제목이 없어도 안 터집니다",
     dropMirrors([{ event_date: D }], [{ date: D }]).length, 1);
  eq("빈 번호끼리는 짝이 아닙니다",
     titles(dropMirrors([{ title: "가", event_date: D, gcal_id: "" }],
                        [{ title: "나", date: D, gid: "" }])), ["나"]);
}

console.log("\n" + "─".repeat(60));
console.log(bad ? bad + "개가 어긋납니다" : "모두 지나갔습니다");
process.exit(bad ? 1 : 0);
