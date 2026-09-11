// ─── 주간점검회의 자료 읽기 시험 ─────────────────────────────
//
//   돌리는 법 :  node tools/test/weekly.mjs   (node 가 없으면 _weeklytest.html 을 로컬 서버로)
//
// 「주간점검회의에 남지현 이름으로 올라오는 수정내용이 있으면 내 캘린더에 반영 — 추가하지 말고 기존 내용을 수정」

import { weekOf, dateIn, timeIn, whenWhere, parseWeekly, matchItems, overlap }
  from "../../assets/js/notes-weekly.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) + "\n      바란 값: " + JSON.stringify(want));
};

console.log("\n── 날짜 · 시각 · 장소 ──");
eq("자료 머리의 주간", weekOf("회 의 자 료2026. 9. 7. ~ 9. 11."), { year: 2026, from: "2026-09-07", to: "2026-09-11" });
eq("달이 바뀌는 주간", weekOf("회 의 자 료2026. 8. 31. ~ 9. 4."), { year: 2026, from: "2026-08-31", to: "2026-09-04" });
eq("날짜 꼴들", [dateIn("9월 10일(목)", 2026), dateIn("9/9(수)", 2026), dateIn("9.9.(수)", 2026), dateIn("2026.9.8.(화)", 2020), dateIn("없음", 2026)],
   ["2026-09-10", "2026-09-09", "2026-09-09", "2026-09-08", ""]);
eq("시각 꼴들", [timeIn("14:00"), timeIn("오후 2시"), timeIn("10시 30분"), timeIn("09:15"), timeIn("9시 30분-11시 30분"), timeIn("")],
   ["14:00", "14:00", "10:30", "09:15", "09:30", ""]);
eq("일시 및 장소 한 줄", whenWhere("8월 31일(월) 14:00, 국토부 회의실", 2026),
   { date: "2026-08-31", dateTo: "", time: "14:00", place: "국토부 회의실" });
eq("이틀짜리", whenWhere("9월 10일(목)~11일(금), 부산 BEXCO", 2026),
   { date: "2026-09-10", dateTo: "2026-09-11", time: "", place: "부산 BEXCO" });
eq("장소 미정", whenWhere("9월 3일(목) 14:00 장소 미정", 2026).place, "");

console.log("\n── 자료에서 내 항목 뽑기 ──");
const T = "회 의 자 료2026. 8. 31. ~ 9. 4.\n" +
  "❑부서 기타업무1. (대외, 남지현) 국토부 훼손지 정비사업 자문회의 참석 Ÿ일시 및 장소 : 8월 31일(월) 14:00, 국토부 회의실 Ÿ주제 : 남양주, 하남, 안산 관련 상정안건 자문 " +
  "2. (대외, 남지현) 국토도시계획학회「복합환승센터와 도심주거 다각화」주제발표Ÿ일시 및 장소 : 9월 2일(수) 15:00, 서울역 공항철도회의실" +
  "3. (대외, 남지현) 인재교육개발원 강의 [경기북부에서 평화를 묻다]Ÿ일시 및 장소 : 9월 3일(목) 15:00, 경기인재개발원 북부캠퍼스Ÿ발표주제 : 경기북부의 안보지리적 중요성 " +
  "4. (정책, 유지현) 택지개발지구 미매각용지 회의Ÿ일시 및 장소 : 9월 3일(목) 14:00 장소 미정" +
  "1. (옥진아, 남지현, 김희재) World Smart City Expo 2026 참가Ÿ일시 및 장소 : 9월 10일(목)~11일(금), 부산 BEXCO\n" +
  "3. 연구성과 보고회 개최분류과제명책임자개최일시간내부평가위원정책경 기 도  피 지 컬  A I방 위 산 업  생 태 계  조 성 전 략남지현9/909:15배영임정책경기-강원 DMZ 접경권 초광역 연계발전 전략연구남지현-8.31❑";
const items = parseWeekly(T);
eq("★ 내 이름이 든 항목만 (유지현 것은 뺌)", items.map((x) => x.date + " " + x.title.slice(0, 14)),
   ["2026-08-31 국토부 훼손지 정비사업 자", "2026-08-31 연구위원회 — 경기-강원 ", "2026-09-02 국토도시계획학회「복합환승센",
    "2026-09-03 인재교육개발원 강의 [경기", "2026-09-09 성과보고회 — 경기도피지컬", "2026-09-10 World Smart Ci"]);
const a = items.find((x) => x.date === "2026-08-31" && /훼손지/.test(x.title));
eq("시각·장소·주제", [a.time, a.place, a.note], ["14:00", "국토부 회의실", "남양주, 하남, 안산 관련 상정안건 자문"]);
eq("여럿 이름에 섞여도 내 것", items.some((x) => /World Smart City/.test(x.title) && x.dateTo === "2026-09-11"), true);
eq("표에서 뽑은 성과보고회 시각", items.find((x) => /성과보고회/.test(x.title)).time, "09:15");
eq("이름을 바꿔 뽑기", parseWeekly(T, { names: ["유지현"] }).map((x) => x.date), ["2026-09-03"]);
eq("빈 것", [parseWeekly(""), parseWeekly(null)], [[], []]);

console.log("\n── 기존 글에 맞추기 ──");
const rows = [
  { id: "a", category: "schedule", title: "[자문참석] 훼손지 자문회의", event_date: "2026-08-31", event_time: "", place: "", event: "" },
  { id: "b", category: "schedule", title: "[발표] 국토도시계획학회 역세권", event_date: "2026-09-02", event_time: "14:00", place: "서울역", event: "" },
  { id: "c", category: "schedule", title: "치과", event_date: "2026-09-02", event_time: "10:00", place: "", event: "" },
  { id: "d", category: "schedule", title: "WSCE 부산", event_date: "2026-09-10", event_time: "", place: "부산 BEXCO", event: "World Smart City Expo 2026 참가" },
  { id: "e", category: "diary", title: "일기", event_date: "2026-09-03" },
];
const r = matchItems(items, rows);
eq("★ 같은 날 글에만 맞추고, 새 글은 안 만든다", r.changes.map((c) => c.row.id), ["a", "b"]);
eq("고칠 값 — 시각·장소·행사명", r.changes[0].patch, { event_time: "14:00", place: "국토부 회의실", event: "국토부 훼손지 정비사업 자문회의 참석" });
eq("같은 날 글이 둘이면 제목이 겹치는 쪽", r.changes[1].row.id, "b");
eq("이미 같으면 건너뜀", r.skipped.some((s) => s.item.date === "2026-09-10" && /이미 같/.test(s.why)), true);
eq("그날 글이 없으면 건너뜀 (일기는 안 봄)", r.skipped.filter((s) => /없습니다/.test(s.why)).map((s) => s.item.date), ["2026-08-31", "2026-09-03", "2026-09-09"]);
eq("낱말 겹침", overlap("국토도시계획학회 주제발표", "[발표] 국토도시계획학회 역세권"), 1);
eq("험한 것", matchItems(null, null), { changes: [], skipped: [] });

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
globalThis.__testBad = bad;
if (typeof process !== "undefined" && process.exit) process.exit(bad ? 1 : 0);
