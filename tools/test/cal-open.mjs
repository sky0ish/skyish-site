// ─── 달력에서 무엇을 열 것인가 시험 ─────────────────────────
//
//   돌리는 법 :  node tools/test/cal-open.mjs
//
// 「회색 상자 줄을 눌렀는데 게시글이 아니라 달력이 나온다」 와
// 「날짜를 누르면 그날 일정을 먼저 고르게」 를 지키기 위한 시험입니다.

import { linkTo, newLink, dayAction, dayLabel } from "../../assets/js/cal-open.js";

let bad = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { console.log("  ✓ " + name); return; }
  bad++;
  console.log("  ✗ " + name + "\n      나온 값: " + JSON.stringify(got) +
                              "\n      바란 값: " + JSON.stringify(want));
};
/* 주소를 뜯어 봅니다 — 물음표 뒤 짝들을 그대로 */
const q = (url) => Object.fromEntries(new URLSearchParams(url.split("?")[1] || ""));

console.log("\n── 한 단계 더 둘 것인가 ──");
/* 사용자가 이르기를 「하나밖에 없으면 지금처럼 바로 게시판 수정으로,
   여러개가 있을때는 한단계 더」 */
eq("일정이 없는 날 — 새로 쓰기", dayAction([]), "none");
eq("하나뿐이면 곧바로 그 글로", dayAction([{ id: "a" }]), "one");
eq("둘이면 먼저 고르게", dayAction([{ id: "a" }, { g: 1 }]), "many");
eq("여럿이면 먼저 고르게", dayAction([1, 2, 3, 4, 5]), "many");
eq("아무것도 아닌 것", [dayAction(null), dayAction(undefined), dayAction("이상한값")],
   ["none", "none", "none"]);

console.log("\n── 내가 쓴 글 — 그 글의 고치기 창으로 ──");
eq("일정 글", q(linkTo({ id: "42", cat: "schedule" }, "2026-09-07", false)),
   { cat: "schedule", id: "42" });
eq("일기 글", q(linkTo({ id: "7", cat: "diary" }, "2026-09-07", false)),
   { cat: "diary", id: "7" });
eq("그 밖의 게시판 글도 일정으로 봅니다",
   q(linkTo({ id: "9", cat: "minutes" }, "2026-09-07", false)).cat, "schedule");
eq("앱에서 눌렀으면 되돌아올 표시를 답니다",
   q(linkTo({ id: "42", cat: "schedule" }, "2026-09-07", true)).back, "app");
eq("첫 화면에서는 달지 않습니다 — 앱으로 튀면 안 됩니다",
   q(linkTo({ id: "42", cat: "schedule" }, "2026-09-07", false)).back, undefined);

console.log("\n── 구글에서 온 일정 — 그날 새 일정 창으로 ──");
/* 전에는 그냥 "blog.html?cat=schedule" 이었습니다. 그러면 받는 쪽에서 열 것이
   없어 아무 일도 안 하고, 뒤이어 도는 autoCal() 이 달력을 펴 버립니다 —
   「눌렀더니 게시글이 아니라 달력이 나온다」 가 바로 이것이었습니다. */
const g = q(linkTo({ t: "착수심의", time: "14:00", place: "경기연구원" }, "2026-09-07", true));
eq("그날로 새 글 창을 연다", [g.cat, g.new], ["schedule", "2026-09-07"]);
eq("제목을 실어 보낸다", g.gt, "착수심의");
eq("시각도", g.gtm, "14:00");
eq("장소도", g.gp, "경기연구원");
eq("앱이면 되돌아올 표시도", g.back, "app");
eq("시각이 없으면 시각은 안 붙인다",
   q(linkTo({ t: "종일 일정" }, "2026-09-07", false)).gtm, undefined);
eq("장소가 없으면 장소도 안 붙인다",
   q(linkTo({ t: "종일 일정" }, "2026-09-07", false)).gp, undefined);
eq("제목에 &·? 가 섞여도 주소가 깨지지 않는다",
   q(linkTo({ t: "가&나?다=라" }, "2026-09-07", false)).gt, "가&나?다=라");
/* 구글이 매긴 번호도 함께 — 「삭제」 가 이것으로 구글 쪽 일정을 지웁니다 */
const gd = q(linkTo({ t: "뮤콘", gid: "abc123", calId: "x@group.calendar.google.com" },
                    "2026-09-07", true));
eq("일정 번호를 실어 보낸다", gd.gid, "abc123");
eq("어느 캘린더인지도", gd.gc, "x@group.calendar.google.com");
eq("번호가 없으면 안 붙인다",
   [q(linkTo({ t: "무언가" }, "2026-09-07", false)).gid,
    q(linkTo({ t: "무언가" }, "2026-09-07", false)).gc], [undefined, undefined]);
eq("내 글에는 번호를 안 붙인다",
   q(linkTo({ id: "9", cat: "schedule", gid: "abc" }, "2026-09-07", false)).gid, undefined);

console.log("\n── 날짜가 없거나 이상하면 ──");
/* 날짜를 못 믿으면 새 글 창을 열 수 없습니다 — 일정 게시판으로만 보냅니다 */
eq("날짜가 없으면", linkTo({ t: "무언가" }, "", false), "blog.html?cat=schedule");
eq("날짜가 이상하면", linkTo({ t: "무언가" }, "2026-9-7", false), "blog.html?cat=schedule");
eq("그때도 앱 표시는 지킨다",
   q(linkTo({ t: "무언가" }, "", true)).back, "app");

console.log("\n── 새로 쓰기 ──");
eq("일기", q(newLink("diary", "2026-09-07", true)),
   { cat: "diary", new: "2026-09-07", back: "app" });
eq("일정", q(newLink("schedule", "2026-09-07", false)),
   { cat: "schedule", new: "2026-09-07" });

console.log("\n── 날짜 이름표 ──");
eq("요일까지", dayLabel("2026-09-07"), "2026.09.07 (월)");
eq("일요일", dayLabel("2026-09-06"), "2026.09.06 (일)");
eq("날짜가 아니면 그대로", dayLabel("아무거나"), "아무거나");
eq("빈 것", dayLabel(""), "");

console.log(bad ? `\n✗ ${bad} 군데 어긋납니다\n` : "\n✓ 모두 지납니다\n");
process.exit(bad ? 1 : 0);
