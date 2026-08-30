// ─── 사람들 셈 시험 ────────────────────────────────────────
//
//   돌리는 법 :  node tools/test/stats.mjs
//
// 화면 없이 셈만 확인합니다. 오늘 날짜를 넣어 줄 수 있게 만들어 두어
// 「이번 달」 같은 것도 흔들리지 않고 시험됩니다.

import * as S from "../../assets/js/notes-stats.js";

let bad = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + a + "\n      바란 값: " + b);
};

const TODAY = new Date(2026, 7, 30);          // 2026-08-30

const rows = [
  { id: "a", category: "schedule", event_date: "2026-08-28",
    title: "20260828_[토론] 자치행정 토론회", tag: "토론", event: "제12회 지방자치 토론회",
    place: "대전철도청", people: "박진우 (수원시정연구원), 이소라, 김철수 (경기연구원)" },
  { id: "b", category: "diary", event_date: "2026-08-30",
    title: "2026.08.30 (일) 남편이랑 강남", place: "강남", people: "남편" },
  { id: "c", category: "schedule", event_date: "2026-07-14",
    title: "논문발표", tag: "발표", event: "대한국토도시계획학회 춘계학술대회",
    place: "서울대학교", people: "이소라 (국토연구원), 최영희" },
  { id: "d", category: "minutes", event_date: "2026-02-03",
    title: "부서회의", people: "김철수, 이소라" },
  { id: "e", category: "schedule", event_date: "2024-01-05",   // 1년 넘은 것 — 달 셈에서 빠집니다
    title: "옛날 일", people: "옛사람" },
  { id: "f", category: "schedule", event_date: "2026-08-05", title: "메모만", people: "" },
];

console.log("\n── 사람별로 모으기 ──");
const ppl = S.byPerson(rows);
eq("사람 수", ppl.length, 6);   // 박진우·이소라·김철수·남편·최영희·옛사람
eq("가장 자주 만난 분", [ppl[0].key, ppl[0].meets.length], ["이소라", 3]);
eq("소속이 붙은 쪽을 이름표로", ppl[0].label, "이소라 (국토연구원)");
eq("김철수는 두 번", ppl.find((p) => p.key === "김철수").meets.length, 2);
eq("만난 사람 없는 글은 안 셈", ppl.some((p) => p.meets.some((r) => r.id === "f")), false);

console.log("\n── TOP 10 ──");
const top = S.topPeople(rows, 10);
eq("차례", top.slice(0, 3).map((p) => p.key + ":" + p.meets.length),
   ["이소라:3", "김철수:2", "남편:1"]);

console.log("\n── 달마다 (최근 12개월) ──");
const mm = S.monthly(rows, 12, TODAY);
eq("칸 12개", mm.length, 12);
eq("맨 앞은 2025-09", mm[0].ym, "2025-09");
eq("맨 뒤는 2026-08", mm[11].ym, "2026-08");
const aug = mm.find((x) => x.ym === "2026-08");
eq("8월 만난 자리", aug.meets, 2);                      // a, b (f 는 사람이 없음)
eq("8월 만난 사람", aug.people, 4);                     // 박진우·이소라·김철수·남편
eq("7월", [mm.find((x) => x.ym === "2026-07").meets,
           mm.find((x) => x.ym === "2026-07").people], [1, 2]);
eq("2월", mm.find((x) => x.ym === "2026-02").meets, 1);
eq("1년 넘은 것은 안 들어옴", mm.some((x) => x.ym === "2024-01"), false);

console.log("\n── 텍스트마이닝 ① 사람 ──");
eq("가장 잦은 사람", S.wordsPeople(rows, 3).map((x) => x.word + ":" + x.n),
   ["이소라:3", "김철수:2", "남편:1"]);

console.log("\n── 텍스트마이닝 ② 기관 ──");
const org = S.wordsOrg(rows, 20).map((x) => x.word);
eq("괄호 안 소속을 줍는다", org.includes("수원시정연구원") && org.includes("경기연구원"), true);
eq("행사명 속 학회도 줍는다", org.includes("대한국토도시계획학회"), true);
eq("장소의 대학교도 줍는다", org.includes("서울대학교"), true);
eq("철도청도 기관으로 줍는다", org.includes("대전철도청"), true);

console.log("\n── 텍스트마이닝 ③ 행사 낱말 ──");
const ev = S.wordsEvent(rows, 30).map((x) => x.word);
eq("행사 낱말", ev.includes("지방자치") && ev.includes("토론회"), true);
eq("「제」를 뗀다", ev.includes("12회"), false);
eq("날짜는 안 센다", ev.some((w) => /^2026$|^\(일\)$|^08$/.test(w)), false);
eq("흔한 말은 뺀다", ev.includes("회의"), false);
eq("만난 사람 이름은 주제가 아니다",
   S.wordsEvent([{ title: "(박진우) 자치행정 토론회", people: "박진우, 이소라" }], 20)
     .some((x) => x.word === "박진우" || x.word === "이소라"), false);
eq("이름에 직함·토씨가 붙어도 사람이다",
   S.wordsEvent([{ title: "김진령주무관 남편이랑 위원회", people: "김진령, 남편" }], 20)
     .map((x) => x.word), ["위원회"]);

console.log("\n── 낱말 고르기 ──");
eq("한 글자 뺀다", S.keepWord("가"), false);
eq("숫자만 뺀다", S.keepWord("2026"), false);
eq("「3회」 뺀다", S.keepWord("3회"), false);
eq("보통 낱말", S.keepWord("도시재생"), true);

console.log("\n── 구름 크기 ──");
const sc = S.scale(S.wordsPeople(rows, 5));
eq("가장 잦은 것이 1", sc[0].t, 1);
eq("가장 드문 것이 0", sc[sc.length - 1].t, 0);

console.log("\n── 자료 테두리 ──");
const sp = S.span(rows);
eq("언제부터", sp.from, "2024-01-05");
eq("언제까지", sp.to, "2026-08-30");
eq("걸친 달 수", sp.months, 32);                       // 2024.01 ~ 2026.08
eq("센 글", sp.count, 5);                              // 사람 없는 f 는 밖
eq("게시판별", sp.byCat, { schedule: 3, diary: 1, minutes: 1 });
eq("달 수를 말로", S.spanWord(32), "2년 8개월");
eq("한 해 밑", S.spanWord(8), "8개월");
eq("꼭 한 해", S.spanWord(12), "1년");
eq("빈 자료", S.span([]).count, 0);

console.log("\n── 한눈 요약 ──");
const sm = S.summary(rows, TODAY);
eq("사람 수", sm.people, 6);
eq("만난 자리", sm.meets, 5);
eq("이번 달 만난 사람", sm.thisMonth, 4);
eq("가장 자주", sm.most.key, "이소라");

console.log("\n" + "─".repeat(60));
console.log("[사람 메모]");
{
  const B = [
    "이천시청부터 이천의 주요 사이트",
    "부발역근처, 하이닉스정문",
    "",
    "(사람) 이석준 군협력담당관님께 넘 감사드립니다.",
    "참 따뜻한 사람이시다.",
    "커피까지 풀코스로 쏘셨다...",
    "",
    "<사람> 강한구 박사님은 방산 쪽에 해박하시다",
  ].join(String.fromCharCode(10));
  const r = { body: B, people: "이석준, 강한구" };

  const ns = S.personNotes(B);
  eq("단락 둘을 뽑는다", ns.length, 2);
  eq("단락을 통째로 담는다", ns[0].split(String.fromCharCode(10)).length, 3);
  eq("말머리를 뗀다", ns[0].startsWith("이석준 군협력담당관님께"), true);
  eq("<사람> 도 받는다", ns[1].startsWith("강한구"), true);
  eq("말머리 없는 단락은 안 담는다", ns.some((x) => x.includes("부발역")), false);

  const m = S.notesByPerson([r]);
  eq("사람별로 모은다", [...m.keys()].sort(), ["강한구", "이석준"]);
  eq("이석준 단락에 커피 이야기까지", m.get("이석준")[0].text.includes("커피까지"), true);

  const m2 = S.notesByPerson([{ body: "(사람) 김병규 교수님 소개로 만남", people: "" }]);
  eq("만난 사람 칸이 비어도 이름을 잡는다", [...m2.keys()], ["김병규"]);
  eq("말머리 없으면 무시", S.notesByPerson([{ body: "이석준 좋았다", people: "이석준" }]).size, 0);
}

console.log("[이름표]");
{
  eq("직함만 있을 때", S.whoTitle("이석준", ["이석준 군협력담당관님께 넘 감사드립니다."]), "군협력담당관");
  eq("소속+직함", S.whoTitle("이석준", ["이석준 이천시청 군협력담당관"]), "이천시청 군협력담당관");
  eq("교수", S.whoTitle("김병규", ["김병규 성균관대학교 교수님 소개"]), "성균관대학교 교수");
  eq("못 찾으면 빈 글", S.whoTitle("남편", ["남편이랑 강남 갔다"]), "");
  eq("메모 여러 줄 중에서", S.whoTitle("강한구",
     ["강한구 좋았다", "강한구 국방연구원 책임연구위원"]), "국방연구원 책임연구위원");
}

console.log("\n" + "─".repeat(60));
console.log(bad ? bad + "개가 어긋납니다" : "모두 지나갔습니다");
process.exit(bad ? 1 : 0);
