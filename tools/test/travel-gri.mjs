// ─── 여행 글 ↔ 출장보고서 기간 맞추기 시험 ──────────────────
//
//   돌리는 법 :  node tools/test/travel-gri.mjs
//
// 「출장보고서 중 내 이름으로 된 것이 Travel 의 여행과 시기가 겹치면 그 글 위에서 받게」
// 여기 보고서는 지어낸 것이고, 날짜 꼴만 실제 gri.json 과 같습니다.
import { readFileSync } from "fs";

/* 모듈은 auth/auth.js 를 들여오고 document 가 없으면 아무것도 하지 않습니다 — 시늉으로 막습니다 */
const src = readFileSync(new URL("../../assets/js/travel-post-gri.js", import.meta.url), "utf8")
  .replace(/^import \{[^}]*\} from "\.\.\/\.\.\/auth\/auth\.js";$/m,
    "const sb = null; const analysisAccess = async () => ({ state: 'guest' }); const loadAnalysisJson = async () => ({ posts: [] });");
const T = await import("data:text/javascript;base64," + Buffer.from(src, "utf8").toString("base64"));

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) + "\n      바란 값: " + JSON.stringify(want));
};
const ymd = (d) => d.toISOString().slice(0, 10);
const R = (r) => (r ? [ymd(r.from), ymd(r.to)] : null);

console.log("\n── 여행 글의 기간 (제목에서) ──");
eq("[2024.2.26~3.6] — 달을 넘김", R(T.travelRange({ title: "[2024.2.26~3.6] 영국" })), ["2024-02-26", "2024-03-06"]);
eq("[2020.2.18~28] — 끝은 날만", R(T.travelRange({ title: "[2020.2.18~28] 영국" })), ["2020-02-18", "2020-02-28"]);
eq("[2017.12.14~12.17]", R(T.travelRange({ title: "[2017.12.14~12.17] 일본" })), ["2017-12-14", "2017-12-17"]);
eq("[2025.12.28~1.3] — 해를 넘김", R(T.travelRange({ title: "[2025.12.28~1.3] 일본" })), ["2025-12-28", "2026-01-03"]);
eq("제목에 날짜가 없으면 date 의 그 달", R(T.travelRange({ title: "여행준비물", date: "2026.08" })), ["2026-08-01", "2026-08-31"]);
eq("아무것도 없으면 null", T.travelRange({ title: "일본 — 가 보고 싶은 곳", date: "—" }), null);

console.log("\n── 보고서의 기간 (date + period) ──");
eq("「2023년 5월 10일 ~ 5월 20일 (9박11일)」", R(T.reportRange({ date: "2023-05-10", period: "2023년 5월 10일 ~ 5월 20일 (9박11일)" })), ["2023-05-10", "2023-05-20"]);
eq("「2017. 5. 22(월) ~ 2017. 5. 26(금)」 — 연도의 「17. 5」 에 안 속는다", R(T.reportRange({ date: "2017-05-22", period: "2017. 5. 22(월) ~ 2017. 5. 26(금)" })), ["2017-05-22", "2017-05-26"]);
eq("「2017년 3월 29일(수) ~ 4월 1일(토)」 — 달을 넘김", R(T.reportRange({ date: "2017-03-29", period: "2017년 3월 29일(수) ~ 4월 1일(토) (3박4일)" })), ["2017-03-29", "2017-04-01"]);
eq("「‘15. 6.7(일)~6.15(월)」 — 두 자리 해", R(T.reportRange({ date: "2015-06-07", period: "‘15. 6.7(일)~6.15(월) [7박 9일]" })), ["2015-06-07", "2015-06-15"]);
eq("「2020년 02월 18일 ~ 02월 28일」", R(T.reportRange({ date: "2020-02-18", period: "2020년 02월 18일 ~ 02월 28일 (9박11일)" })), ["2020-02-18", "2020-02-28"]);
eq("끝 날이 없으면 시작 + 7일", R(T.reportRange({ date: "2019-10-27", period: "2019년 10월 27일" })), ["2019-10-27", "2019-11-03"]);
eq("달만 알면 그 달 전체", R(T.reportRange({ date: "2015-10", period: "" })), ["2015-10-01", "2015-10-31"]);
eq("date 가 없으면 null", T.reportRange({ period: "x" }), null);

console.log("\n── 겹침과 내 이름 ──");
const mine = { num: 175, date: "2023-05-10", period: "2023년 5월 10일 ~ 5월 20일", travelers: ["남지현", "옥진아"], trip: "베이밸리" };
const other = { num: 176, date: "2023-07-05", period: "2023년 7월 5일 ~ 7월 14일", travelers: ["김채만"], trip: "네덜란드" };
const mineFar = { num: 66, date: "2017-05-22", period: "2017. 5. 22(월) ~ 2017. 5. 26(금)", travelers: ["남지현"], trip: "내진" };
const mineWho = { num: 61, date: "2017-03-29", period: "2017년 3월 29일(수) ~ 4월 1일(토)", travelers: [], who: "도시주택연구실 남지현 연구위원", trip: "도쿄" };
const post = { title: "[2023.5.10~5.18] 영국·아일랜드·네덜란드 답사" };
eq("★ 기간이 겹치는 내 보고서만", T.matchReports(post, [mine, other, mineFar]).map((p) => p.num), [175]);
eq("남의 보고서는 기간이 겹쳐도 안 붙는다", T.matchReports({ title: "[2023.7.5~7.14] 네덜란드" }, [other]).length, 0);
eq("who 글에 이름이 있어도 내 것", T.matchReports({ title: "[2017.3.29~4.1] 일본" }, [mineWho]).map((p) => p.num), [61]);
eq("하루라도 겹치면 붙는다 (여행 5.18~ 보고서 5.10~5.20)", T.matchReports({ title: "[2023.5.18~5.25] 어딘가" }, [mine]).length, 1);
eq("안 겹치면 안 붙는다 (여행 5.21~)", T.matchReports({ title: "[2023.5.21~5.25] 어딘가" }, [mine]).length, 0);
eq("날짜 없는 글은 아무것도", T.matchReports({ title: "체크리스트", date: "—" }, [mine]).length, 0);
eq("빈 목록", T.matchReports(post, null), []);

/* 실제 여행 글 목록에 실제와 같은 날짜의 내 보고서 여섯을 맞춰 봅니다 (이름·제목은 지어냄) */
console.log("\n── 실제 여행 글 목록에 맞춰 보기 ──");
const tjs = readFileSync(new URL("../../assets/data/travel.js", import.meta.url), "utf8");
const posts = [...tjs.matchAll(/slug:\s*"([^"]+)".*?date:\s*"([^"]*)",\s*title:\s*"([^"]*)"/gs)].map((m) => ({ slug: m[1], date: m[2], title: m[3] }));
const reps = [
  { num: 175, date: "2023-05-10", period: "2023년 5월 10일 ~ 5월 20일", travelers: ["남지현"] },
  { num: 121, date: "2017-12-13", period: "2017년 12월 13일(수) ~ 12월 17일(일)", travelers: ["남지현"] },
  { num: 118, date: "2017-11-10", period: "2017년 11월 10일(금) ~ 11월 19일(일)", travelers: ["남지현"] },
  { num: 66,  date: "2017-05-22", period: "2017. 5. 22(월) ~ 2017. 5. 26(금)", travelers: ["남지현"] },
  { num: 61,  date: "2017-03-29", period: "2017년 3월 29일(수) ~ 4월 1일(토)", travelers: ["남지현"] },
  { num: 49,  date: "2016-07-19", period: "2016년 7월 19일(화) ~ 7월 27일(일)", travelers: ["남지현"] },
  { num: 183, date: "2024-02-19", period: "2024년 2월 19일 ~ 2월 28일", travelers: ["권진우"] },   // 남의 것 — 영국 여행과 겹쳐도 안 붙어야
];
const got = {};
posts.forEach((p) => { const h = T.matchReports(p, reps); if (h.length) got[p.slug] = h.map((x) => x.num); });
eq("★ 여섯 여행 글에 각각 한 건씩, 남의 보고서는 안 붙음", got,
   { uknl2305: [175], "tl-20171214": [121], "tl-20171111": [118], "tl-20170522": [66], "tl-20170329": [61], "tl-20160719": [49] });

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
