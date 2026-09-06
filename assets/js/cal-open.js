// ─── 달력에서 무엇을 열 것인가 ──────────────────────────────
//
//  첫 화면·폰 앱의 달력에서 날짜나 일정을 눌렀을 때
//  어디로 갈지 정하는 규칙만 모아 둔 곳입니다.
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험할 수 있습니다
//  (tools/test/cal-open.mjs).

/** 하루치 일정을 눌렀을 때 무엇을 할 것인가.
 *    "one"  — 한 건뿐이니 곧바로 그 글로
 *    "many" — 여럿이니 먼저 목록을 펴고 고르게
 *    "none" — 없으니 새로 쓰기
 *  사용자가 이르기를 「하나밖에 없으면 지금처럼 바로 게시판 수정으로,
 *  여러개가 있을때는 한단계 더」. */
export function dayAction(list) {
  const n = (Array.isArray(list) ? list : []).length;
  return n === 0 ? "none" : n === 1 ? "one" : "many";
}

/** 일정 하나가 어디로 이어질지.
 *
 *  ⓐ 내가 쓴 글 (id 가 있음)      → 그 글의 「고치기」 창
 *  ⓑ 구글에서 온 일정 (id 가 없음) → 그날 새 일정 창.
 *     제목과 시각을 실어 보내 미리 채워 둡니다. 저장하면 그때부터
 *     내 글이 되어 다음부터는 ⓐ 로 열립니다.
 *
 *  전에는 ⓑ 가 그냥 "blog.html?cat=schedule" 이었습니다. 그러면 받는 쪽에서
 *  열 것이 없어 아무 일도 안 하고, 뒤이어 도는 autoCal() 이 달력을 펴 버립니다
 *  — 「눌렀더니 게시글이 아니라 달력이 나온다」 가 바로 이것이었습니다.
 *
 *  @param x    {id, cat, t, time} — 달력 칸에 담아 둔 일정 하나
 *  @param day  "2026-09-07"
 *  @param app  폰 앱에서 부른 것인가 (그러면 저장·취소 뒤 앱으로 돌아옵니다)
 */
export function linkTo(x, day, app) {
  const e = (s) => encodeURIComponent(String(s == null ? "" : s));
  const back = app ? "&back=app" : "";
  if (x && x.id) {
    const cat = x.cat === "diary" ? "diary" : "schedule";
    return "blog.html?cat=" + cat + "&id=" + e(x.id) + back;
  }
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) ? day : "";
  if (!d) return "blog.html?cat=schedule" + back;
  return "blog.html?cat=schedule&new=" + d +
         "&gt=" + e((x && x.t) || "") +
         ((x && x.time) ? "&gtm=" + e(x.time) : "") +
         ((x && x.place) ? "&gp=" + e(x.place) : "") + back;
}

/** 그날 새로 쓰기 — 게시판을 골라 갑니다 */
export function newLink(cat, day, app) {
  return "blog.html?cat=" + (cat || "schedule") + "&new=" + day + (app ? "&back=app" : "");
}

/** 「2026-09-07」 → 「2026.09.07 (월)」 */
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export function dayLabel(day) {
  const s = String(day || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s + "T00:00:00");
  const w = isNaN(d.getTime()) ? "" : " (" + WEEK[d.getDay()] + ")";
  return s.replace(/-/g, ".") + w;
}
