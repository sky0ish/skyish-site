// ─── 세미나 행사 정보 → 개요 시험 ────────────────────────────
//   돌리는 법 :  node tools/test/seminar.mjs
import { readFileSync } from "node:fs";
import { parseBrief, peopleInLine, dateIn, timeIn, briefPeople, briefBody, pickRow, patchFor, briefJson, briefFromJson }
  from "../../assets/js/notes-seminar.js";
let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++; console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) + "\n      바란 값: " + JSON.stringify(want));
};
const ok = (name, y, x) => { if (y) console.log("  ✓ " + name); else { bad++; console.log("  ✗ " + name + (x ? " — " + JSON.stringify(x) : "")); } };

console.log("\n── 사람 뽑기 ──");
eq("이름 직함, 소속", peopleInLine("이현주 연구위원, 국토연구원"), [{ name: "이현주", title: "연구위원", org: "국토연구원" }]);
eq("이름 직함(소속)", peopleInLine("김두환 연구위원(LHRI)"), [{ name: "김두환", title: "연구위원", org: "LHRI" }]);
eq("前 소속", peopleInLine("김현호 원장(前, 고양연구원), 남지현 센터장(경기연구원)").map((p) => p.name + "|" + p.org), ["김현호|前 고양연구원", "남지현|경기연구원"]);
eq("직함이 붙은 낱말은 사람이 아님", peopleInLine("발제자 및 토론자 소개"), []);
eq("날짜 ’26.09.17(목)", dateIn("’26.09.17(목), 13:30~15:30"), "2026-09-17");
eq("날짜 2026년 9월 17일", dateIn("2026년 9월 17일(목) 오후 2시"), "2026-09-17");
eq("시각 범위", timeIn("’26.09.17(목), 13:30~15:30"), { time: "13:30", end: "15:30" });
eq("오후 2시", timeIn("2026년 9월 17일(목) 오후 2시"), { time: "14:00", end: "" });

console.log("\n── LH 세미나 개최계획 ──");
const text = readFileSync(new URL("./fixtures_seminar_lh.txt", import.meta.url), "utf8");
const info = { raw: "20260917_[토론] LH_", date: "2026-09-17", kind: "토론", rest: "LH_", tag: "토론" };
const b = parseBrief(text, info);
eq("주제", b.title, "‘평화와 공존’ 공간의 탐색");
eq("날짜", b.date, "2026-09-17");
eq("시각", [b.time, b.end], ["13:30", "15:30"]);
eq("장소", b.place, "LH 토지주택연구원 행정동 2층 대회의실");
eq("주최/주관", [b.host, b.organizer], ["LHRI 지역균형연구실", "글로벌ㆍ북한연구센터"]);
eq("사회", b.mc.map((p) => p.name), ["이승은"]);
eq("좌장", b.chair.map((p) => p.name), ["이미홍"]);
eq("발제자 셋", b.presenters.map((p) => p.name), ["이현주", "김두환", "박기태"]);
eq("발제 제목", b.presenters.map((p) => p.topic), ["평화경제특구의 과제와 전망", "개성공단 재개의 여건 진단과 과제", "2026년 LH 남북협력사업 추진전략"]);
eq("발제 소속", b.presenters.map((p) => p.org), ["국토연구원", "LH 토지주택연구원", "LH 글로벌 사업처"]);
eq("토론자 넷", b.discussants.map((p) => p.name), ["김현호", "남지현", "김민아", "이승지"]);
eq("프로그램 줄", b.program.length >= 4, true);
const people = briefPeople(b, ["남지현"]);
eq("만난 사람(나 빼고)", people, ["이승은 (LH 토지주택연구원)", "이미홍 (LH 토지주택연구원)", "이현주 (국토연구원)", "김두환 (LH 토지주택연구원)", "박기태 (LH 글로벌 사업처)", "김현호 (前 고양연구원)", "김민아 (국토연구원)", "이승지 (LHRI)"]);
const body = briefBody(b, info);
ok("본문에 주제·일시·발제·토론", /주제: ‘평화와 공존’/.test(body) && /일시: 2026.09.17 13:30~15:30/.test(body) && /발제:/.test(body) && /토론: 김현호/.test(body), body);

console.log("\n── 그날 글 고르기 · 고침 ──");
const rows = [
  { id: 1, category: "schedule", title: "LH이미홍—토론", event_date: "2026-09-17", event_time: "01:30", people: "", body: "", gcal_id: "g1" },
  { id: 2, category: "schedule", title: "부서회의 및 점심", event_date: "2026-09-15" },
  { id: 3, category: "schedule", title: "치과", event_date: "2026-09-17", event_time: "18:00" },
];
const hit = pickRow(rows, info, b);
eq("같은 날 「LH」 가 든 글을 고른다", hit && hit.id, 1);
const merge = (cur, list) => [String(cur || "")].filter(Boolean).concat(list).join(", ");
const patch = patchFor(b, hit, info, merge, ["남지현"]);
eq("시각 01:30 → 13:30", patch.event_time, "13:30");
eq("장소", patch.place, "LH 토지주택연구원 행정동 2층 대회의실");
eq("행사명", patch.event, "‘평화와 공존’ 공간의 탐색");
ok("만난 사람", /이미홍/.test(patch.people) && /김현호/.test(patch.people), patch.people);
ok("본문 개요", /주제:/.test(patch.body), patch.body.slice(0, 60));
eq("말머리", patch.tag, "토론");
eq("없는 날엔 null", pickRow(rows, { raw: "20260918_[토론] x", date: "2026-09-18", rest: "x" }, { date: "2026-09-18", title: "" }), null);

console.log("\n── 개최개요.json 왕복 ──");
const j = briefJson(b, info);
eq("json 일시", j["일시"], "2026.09.17 13:30~15:30");
eq("json 외부 9명(나 포함)", j["외부"].split(", ").length, 9);
const b2 = briefFromJson(j, info);
eq("되읽은 발제자", b2.presenters.map((p) => p.name), ["이현주", "김두환", "박기태"]);
eq("되읽은 시각", [b2.time, b2.date], ["13:30", "2026-09-17"]);
eq("옛 꼴(외부만)도 읽는다", briefFromJson({ "일시": "2026.9.2 14:00", "장소": "x", "외부": "김고은 (국토연구원), 박철수" }, { date: "2026-09-02" }).attendees.map((p) => p.name), ["김고은", "박철수"]);

/* ── 행사 포스터(그림) 꼴 — 「info에 행사정보가 있으니 … 토론자, 발표자가 안 들어가있어」 ── */
const POSTER = readFileSync(new URL("./fixtures_seminar_poster.txt", import.meta.url), "utf8");
const bp = parseBrief(POSTER, { date: "2026-09-23" });
eq("★ 포스터 — 시각", [bp.time, bp.end], ["09:30", "12:00"]);
eq("★ 포스터 — 장소", bp.place, "국회의원회관 제2소회의실");
eq("★ 포스터 — 사회·좌장", [bp.mc.map((p) => p.name), bp.chair.map((p) => p.name)], [["홍성우"], ["김선주"]]);
eq("★ 포스터 — 발제자 셋", bp.presenters.map((p) => p.name), ["이강훈", "이영은", "한중석"]);
eq("★ 포스터 — 발제 제목", bp.presenters[1].topic, "청년도심거주를 위한 특화형 매입임대의 진단과 향후과제");
eq("★ 포스터 — 토론자 여섯", bp.discussants.map((p) => p.name), ["김경기", "남지현", "오정석", "장인선", "장창훈", "황성주"]);
eq("★ 포스터 — 만난 사람(나 빼고)에 헛이름이 없다",
   briefPeople(bp, ["남지현"]).map((x) => x.split(" (")[0]),
   ["홍성우", "김선주", "이강훈", "이영은", "한중석", "김경기", "오정석", "장인선", "장창훈", "황성주"]);

/* ── 그날 글이 하나뿐이면 제목이 달라도 그 글에 — 「구글에서 온 LH이미홍ㅡ토론」 ── */
const ONE = [{ id: "g1", category: "schedule", event_date: "2026-09-17", title: "LH이미홍ㅡ토론", tag: "" }];
const jobOne = { raw: "20260917_[토론] LH_평화와공존공간의탐색", date: "2026-09-17", rest: "평화와공존공간의탐색" };
eq("★ 그날 글 하나면 제목이 달라도 그 글",
   (pickRow(ONE, jobOne, { date: "2026-09-17", title: "", host: "", organizer: "" }) || {}).id, "g1");
eq("그날 글이 둘이면 함부로 고르지 않는다",
   pickRow(ONE.concat([{ id: "g2", category: "schedule", event_date: "2026-09-17", title: "딴 일정", tag: "" }]),
           jobOne, { date: "2026-09-17", title: "", host: "", organizer: "" }), null);

console.log(bad ? "\n✗ " + bad + " 군데 어긋납니다" : "\n✓ 모두 지납니다");
process.exit(bad ? 1 : 0);
