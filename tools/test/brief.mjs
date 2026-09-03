// ─── 개최개요·프로그램 읽기 시험 ────────────────────────────
//
//   돌리는 법 :  node tools/test/brief.mjs
//
// 심포지엄 안내문을 붙이면 행사명·날짜·시각·장소·만난 사람이
// 저절로 칸에 들어가야 합니다.

import { readBrief, peopleIn, looksLikeName, findDate, findTime }
  from "../../assets/js/notes-brief.js";

let bad = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + a + "\n      바란 값: " + b);
};
const has = (name, list, want) => {
  if (list.some((x) => x.startsWith(want))) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      「" + want + "」 가 없습니다: " + JSON.stringify(list));
};

console.log("\n── 이름 가려내기 ──");
eq("사람 이름", [looksLikeName("이석준"), looksLikeName("남지현")], [true, true]);
eq("배역은 이름이 아니다", [looksLikeName("발표"), looksLikeName("좌장"), looksLikeName("축사")],
   [false, false, false]);
eq("기관도 아니다", [looksLikeName("연구원"), looksLikeName("경기도청")], [false, false]);
eq("한 글자·다섯 글자는 뺍니다", [looksLikeName("김"), looksLikeName("가나다라마")], [false, false]);

console.log("\n── 줄에서 사람 뽑기 ──");
eq("괄호 소속", peopleIn("14:20 기조발표  남지현 (경기연구원)"), ["남지현 (경기연구원)"]);
// 「만난 사람」 칸은 「이름 (소속)」 꼴로 적습니다 — 직함도 괄호에 넣습니다
eq("직함이 뒤에", peopleIn("좌장 홍길동 교수"), ["홍길동 (교수)"]);
eq("배역이 이름을 먹지 않는다", peopleIn("사회 김철수 박사"), ["김철수 (박사)"]);
eq("이름만 늘어놓기", peopleIn("토론: 김영희, 박민수"), ["김영희", "박민수"]);
eq("배역은 안 뽑습니다", peopleIn("15:00 종합토론 및 질의응답"), []);
eq("빈 줄", peopleIn(""), []);

console.log("\n── 날짜·시각 ──");
eq("한글 날짜", findDate("2026년 9월 2일(화)"), "2026-09-02");
eq("점 날짜", findDate("2026.09.02"), "2026-09-02");
eq("붙은 날짜", findDate("20260902_개최개요"), "2026-09-02");
eq("시각", findTime("14:00~17:00"), "14:00");
eq("오후 두 시", findTime("오후 2시 30분"), "14:30");
eq("오전 열두 시", findTime("오전 12시"), "00:00");
eq("없으면 빈 글", [findDate("없음"), findTime("없음")], ["", ""]);

console.log("\n── ① 개최개요 꼴 ──");
{
  const r = readBrief([
    "자문회의 개최건의",
    "사 업 명 : 2026년 경기도 방산클러스터 조성전략 수립",
    "개최일시 : 2026년 9월 2일(화) 14:00~17:00",
    "장    소 : 경기연구원 대회의실",
    "참석대상 : 4인",
    "외부참여진(3인) : 이석준(이천시청), 강한구(국방연구원), 김창수 교수",
  ]);
  eq("행사명", r.event, "2026년 경기도 방산클러스터 조성전략 수립");
  eq("날짜", r.date, "2026-09-02");
  eq("시각", r.time, "14:00");
  eq("장소", r.place, "경기연구원 대회의실");
  has("이석준", r.people, "이석준");
  has("강한구", r.people, "강한구");
  has("김창수", r.people, "김창수");
  eq("사람 셋", r.people.length, 3);
}

console.log("\n── ② 프로그램 꼴 ──");
{
  const r = readBrief([
    "경기도 방산혁신 심포지엄",
    "일시 2026. 9. 2.(화) 14:00 ~ 17:30",
    "장소 : 수원컨벤션센터 3층 컨벤션홀",
    "14:00  개회사   김지사 (경기도지사)",
    "14:10  축사     이의원 (국회의원)",
    "14:20  기조발표  남지현 (경기연구원)",
    "15:00  발표 1  「방산 클러스터의 조건」 강한구 (국방연구원)",
    "16:00  종합토론  좌장: 홍길동 교수 / 토론: 김영희, 박민수",
    "17:30  폐회",
  ]);
  eq("날짜", r.date, "2026-09-02");
  eq("시각", r.time, "14:00");
  eq("장소", r.place, "수원컨벤션센터 3층 컨벤션홀");
  ["김지사", "이의원", "남지현", "강한구", "홍길동", "김영희", "박민수"]
    .forEach((n) => has(n, r.people, n));
  eq("배역이 섞이지 않았다",
     r.people.filter((p) => /^(개회|축사|기조|발표|토론|좌장|폐회)/.test(p)), []);
}

console.log("\n── 험한 값 ──");
{
  eq("빈 것", readBrief([]), { event: "", date: "", time: "", place: "", people: [] });
  eq("null 도 견딥니다", readBrief(null).people, []);
  eq("글 한 덩이로 줘도 됩니다",
     readBrief("일시 : 2026.09.02 14:00\n장소 : 대회의실").place, "대회의실");
  const r = readBrief(["일시 2026년 9월 2일", "발표 남지현 (경기연구원)", "토론 남지현 박사"]);
  eq("같은 사람은 한 번만", r.people.length, 1);
}

console.log("\n" + "─".repeat(60));
console.log(bad ? bad + "개가 어긋납니다" : "모두 지나갔습니다");
process.exit(bad ? 1 : 0);
