// ─── 시험: 구글 캘린더에서 「빠짐없이」 받아 오는가 ───────────────
//
//   node tools/test/gcal-range.mjs
//
//  브라우저 없이 돌립니다 — localStorage 와 fetch 를 흉내 냅니다.
//  여기서 보는 것은 예전에 일정이 말없이 사라지던 네 가지 길입니다.
//    ① 여러 날에 걸친 일정이 첫날에만 찍히던 것 (추석 연휴·출장)
//    ② 구글에서 체크를 꺼 둔 캘린더가 통째로 빠지던 것 (공휴일·동호회)
//    ③ 목록이 두 쪽으로 넘어가면 둘째 쪽을 안 받던 것
//    ④ 캘린더 하나가 막혀도(429) 아무 말 없이 빈 것으로 넘어가던 것
//    ⑤ 같은 날 이름이 같은 다른 일정이 하나로 합쳐지던 것
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i],
};
localStorage.setItem("skyish-gcal-token", JSON.stringify({ token: "T", exp: Date.now() + 3600e3 }));
localStorage.setItem("skyish-gcal-token-ok", "1");

const CALS = [
  { id: "primary", summary: "내 캘린더", backgroundColor: "#4285f4", selected: true },
  { id: "hol", summary: "대한민국의 휴일", backgroundColor: "#0b8043", selected: false }, // 구글에서 꺼 둠
  { id: "club", summary: "동호회", backgroundColor: "#d50000" },
  { id: "broken", summary: "막힌 캘린더", backgroundColor: "#999999" },
];
const EV = {
  primary: [
    { id: "a1", iCalUID: "a1@g", summary: "학원", start: { date: "2026-09-20" }, end: { date: "2026-09-21" } },
    { id: "a2", iCalUID: "a2@g", summary: "학원", start: { date: "2026-09-20" }, end: { date: "2026-09-21" } }, // 같은 날 같은 이름의 다른 일정
    { id: "a3", iCalUID: "a3@g", summary: "Stay at 선셋 호텔", start: { date: "2026-09-09" }, end: { date: "2026-09-12" } },
    { id: "a4", iCalUID: "a4@g", summary: "취소된 것", status: "cancelled", start: { date: "2026-09-15" }, end: { date: "2026-09-16" } },
  ],
  hol: [
    { id: "h1", iCalUID: "h1@g", summary: "추석 연휴", start: { date: "2026-09-24" }, end: { date: "2026-09-27" } },
  ],
  club: [
    { id: "c1", iCalUID: "c1@g", summary: "동호회", start: { dateTime: "2026-09-23T19:00:00+09:00" }, end: { dateTime: "2026-09-23T21:00:00+09:00" } },
    // 쪽이 넘어가는 자료 — 두 번째 쪽에만 있는 일정
    { id: "c2", iCalUID: "c2@g", summary: "2쪽에 있던 일정", start: { date: "2026-09-29" }, end: { date: "2026-09-30" } },
  ],
};
let brokenTries = 0;
globalThis.fetch = async (url) => {
  const ok = (j) => ({ ok: true, status: 200, json: async () => j, clone() { return this; } });
  if (url.includes("calendarList")) {
    const page = /pageToken=(\w+)/.exec(url);
    if (!page) return ok({ items: CALS.slice(0, 2), nextPageToken: "p2" });
    return ok({ items: CALS.slice(2) });                 // 둘째 쪽
  }
  const m = /calendars\/([^/]+)\/events/.exec(url);
  const id = decodeURIComponent(m[1]);
  if (id === "broken") { brokenTries++; return { ok: false, status: 429, clone() { return this; }, json: async () => ({}) }; }
  const list = EV[id] || [];
  if (id === "club") {
    const page = /pageToken=(\w+)/.exec(url);
    if (!page) return ok({ items: [list[0]], nextPageToken: "e2" });
    return ok({ items: [list[1]] });
  }
  return ok({ items: list });
};

const GC = await import("../../assets/js/gcal.js");
const ev = await GC.range("2026-08-30", "2026-10-10");
const rep = GC.lastReport();
const on = (d) => ev.filter((e) => e.date === d).map((e) => e.title + (e.time ? " " + e.time : ""));

let bad = 0;
const is = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { bad++; console.log("✗ " + name + "\n   받음 " + g + "\n   바람 " + w); }
  else console.log("✓ " + name + "  " + g);
};

is("꺼 둔 공휴일 캘린더도 들어온다 (9/24)", on("2026-09-24"), ["추석 연휴"]);
is("연휴 둘째 날 (9/25)", on("2026-09-25"), ["추석 연휴"]);
is("연휴 마지막 날 (9/26)", on("2026-09-26"), ["추석 연휴"]);
is("연휴가 끝난 날에는 없다 (9/27)", on("2026-09-27"), []);
is("호텔 9/9~9/11 사흘", [on("2026-09-09"), on("2026-09-10"), on("2026-09-11")],
   [["Stay at 선셋 호텔"], ["Stay at 선셋 호텔"], ["Stay at 선셋 호텔"]]);
is("같은 날 같은 이름의 다른 일정이 합쳐지지 않는다 (9/20)", on("2026-09-20"), ["학원", "학원"]);
is("시각이 있는 일정 (9/23)", on("2026-09-23"), ["동호회 19:00"]);
is("둘째 쪽 일정도 받아 온다 (9/29)", on("2026-09-29"), ["2쪽에 있던 일정"]);
is("취소된 일정은 뺀다 (9/15)", on("2026-09-15"), []);
is("막힌 캘린더는 보고서에 남는다", rep.failed.map((f) => f.name), ["막힌 캘린더"]);
is("막힌 캘린더는 몇 번 다시 물어본다", brokenTries >= 3, true);
is("구글에서 꺼 둔 캘린더 수", rep.off, 1);

let seenUrl = "";
const realFetch = globalThis.fetch;
globalThis.fetch = async (u) => { if (u.includes("/events")) seenUrl = u; return realFetch(u); };
await GC.month(2026, 8);            // 2026년 9월 판 — 8/30 ~ 10/10
const min = decodeURIComponent(/timeMin=([^&]+)/.exec(seenUrl)[1]);
const max = decodeURIComponent(/timeMax=([^&]+)/.exec(seenUrl)[1]);
is("달력 판의 앞 회색 칸(8/30)부터 묻는다", new Date(min) <= new Date("2026-08-30T00:00:00+09:00"), true);
is("달력 판의 뒤 회색 칸(10/10)까지 묻는다", new Date(max) > new Date("2026-10-10T00:00:00+09:00"), true);

console.log(bad ? "\n" + bad + "곳 어긋남" : "\n모두 맞음");
process.exit(bad ? 1 : 0);
