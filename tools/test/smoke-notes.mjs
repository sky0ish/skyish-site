// ─── 글쓰기 창 시늉 시험 ───────────────────────────────────
//
//   돌리는 법 :  node tools/test/smoke-notes.mjs .
//
// node --check 는 글월(문법)만 봅니다.
// 「없는 변수를 쓴다」 같은 것은 실제로 눌러 봐야 잡힙니다.
// 실제로 그 탓에 저장이 「저장하는 중…」에서 멈춘 적이 있습니다.
// 화면과 Supabase 는 시늉만 내고, 단추를 눌러 끝까지 가는지 봅니다.
// ──────────────────────────────────────────────────────────
import { readFileSync } from "fs";

const REPO = process.argv[2];
const listeners = new Map();          // id|event → [fn]
const alerts = [], confirms = [];

function makeEl(id) {
  const el = {
    id, value: "", textContent: "", innerHTML: "", hidden: false, disabled: false,
    dataset: {}, files: [], style: {},
    classList: { _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); } },
    addEventListener(ev, fn) {
      const k = id + "|" + ev;
      if (!listeners.has(k)) listeners.set(k, []);
      listeners.get(k).push(fn);
    },
    removeEventListener() {},
    querySelectorAll(sel) {
      // 목록 줄과 지우기 단추는 innerHTML 로 그려지므로, 그 시늉을 냅니다
      if (id === "nList" && /nrow__open|nrow__del/.test(sel)) {
        const b = makeEl(sel.replace(".", "") + "-r1");
        b.dataset.id = "r1";
        return [b];
      }
      return [];
    },
    querySelector() { return makeEl(id + "-child"); },
    closest() { return makeEl(id + "-closest"); },
    appendChild() {}, remove() {}, focus() {}, click() {},
    setSelectionRange() {}, select() {}, blur() {},
  };
  return el;
}

const els = new Map();
const byId = (id) => {
  if (!els.has(id)) els.set(id, makeEl(id));
  return els.get(id);
};

globalThis.document = {
  getElementById: byId,
  createElement: (t) => makeEl("new-" + t),
  addEventListener(ev, fn) {
    const k = "document|" + ev;
    if (!listeners.has(k)) listeners.set(k, []);
    listeners.get(k).push(fn);
  },
  querySelectorAll: () => [],
  body: makeEl("body"),
};
globalThis.location = { search: "", replace() {} };
globalThis.alert = (m) => alerts.push(String(m));
globalThis.confirm = (m) => { confirms.push(String(m)); return true; };
globalThis.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
globalThis.Blob = class {};
globalThis.File = class { constructor(p, n) { this.name = n; this.size = 1; } };

// ── Supabase 시늉 ──
const calls = [];
globalThis.__calls = calls;      // 시늉 모듈 안에서도 닿게 전역으로 둡니다
globalThis.__rows = [{
  id: "r1", category: "schedule", title: "20260828_[토론] (박진우) 자치행정학회",
  body: "시각: 14:00", event_date: "2026-08-28", event_time: "14:00",
  place: "대전철도청", contact: "박진우", people: "이상대 (용인시정연구원)",
  event: "2026 한국지방자치학회 하계국제학술대회", tag: "토론", files: [],
}];
const sbStub = `export const sb = {
  from: () => { const q = {
    select: () => q, order: () => q, eq: () => q,
    insert: (v) => { globalThis.__calls.push(["insert", v]); return q; },
    update: (v) => { globalThis.__calls.push(["update", v]); return q; },
    delete: () => { globalThis.__calls.push(["delete"]); return q; },
    then: (res) => Promise.resolve({ data: globalThis.__rows, error: null, count: 0 }).then(res),
  }; return q; },
  rpc: async () => ({ data: true, error: null }),
  storage: { from: () => ({ upload: async () => ({ error: null }),
    download: async () => ({ data: null, error: null }),
    createSignedUrl: async () => ({ data: { signedUrl: "x" }, error: null }),
    remove: async () => ({}) }) },
};
export const currentUser = async () => ({ id: "u1", email: "skyish76@gmail.com" });
export const myProfile  = async () => ({ is_admin: true, analysis_access: true });`;

const load = (p, extra = (s) => s) => {
  let s = readFileSync(REPO + "/" + p, "utf8");
  s = s.replace(/^import \{[^}]*\} from "\.\.\/\.\.\/auth\/auth\.js";$/m, sbStub);
  s = s.replace(/^import \* as NF from "\.\/notes-files\.js[^"]*";$/m,
    'const NF = { kind: () => "file", niceSize: () => "1B", mergePeople: (a) => a || "",' +
    ' extract: async () => ({ total: 0, mine: [], head: [], people: [], event: "" }),' +
    ' asText: () => "", filesFrom: () => [], upload: async () => ({}),' +
    ' signedUrl: async () => "x", remove: async () => {}, fileFromStore: async () => ({}) };');
  /* 셈 모듈은 시늉이 아니라 진짜를 씁니다 (셈 자체는 tools/test/stats.mjs 가 봅니다).
     data: 꼴 안에서는 상대 경로가 풀리지 않아, 소스를 그대로 심어 넣습니다.
     notes-stats.js 는 아무것도 들여오지 않아 이렇게 해도 됩니다. */
  const statsUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-stats.js", "utf8")).toString("base64");
  s = s.replace(/^import \* as ST from "\.\/notes-stats\.js[^"]*";$/m,
    "const ST = await import(" + JSON.stringify(statsUrl) + ");");
  s = s.replace(/^import \* as GC from "\.\/gcal\.js[^"]*";$/m,
    'const GC = { ready: () => false, connected: () => false, month: async () => [],' +
    ' connect: async () => {}, disconnect() {} };');
  return import("data:text/javascript;base64," + Buffer.from(extra(s)).toString("base64"));
};

const M = await load("assets/js/notes.js");
await M.initNotes("notesapp");

const fire = async (id, ev, arg) => {
  const fns = listeners.get(id + "|" + ev) || [];
  if (!fns.length) throw new Error(`${id} 의 ${ev} 를 아무도 듣고 있지 않습니다`);
  for (const fn of fns) await fn(arg || { target: byId(id), currentTarget: byId(id), preventDefault() {} });
};

let bad = 0;
const check = async (name, fn) => {
  try { await fn(); console.log("  ✓ " + name); }
  catch (e) { bad++; console.log("  ✗ " + name + " — " + e.message); }
};

console.log("글쓰기 창 시늉 시험");
console.log("─".repeat(60));

await check("새 글 열기", () => fire("nNew", "click"));

await check("제목 없이 저장하면 알려 준다", async () => {
  byId("nmT").value = "";
  await fire("nmSave", "click");
  if (!/제목/.test(byId("nmMsg").textContent)) throw new Error("아무 말이 없습니다");
});

await check("글을 채워 저장하면 끝까지 간다", async () => {
  byId("nmT").value = "20260828_[토론] (박진우) 자치행정학회 학술대회";
  byId("nmB").value = "시각: 14:00" + String.fromCharCode(10) + "장소: 대전철도청";
  byId("nmE").value = "2026 한국지방자치학회 하계국제학술대회";
  byId("nmD").value = "2026.08.28";
  byId("nmTm").value = "14:00";
  byId("nmC").value = "박진우";
  byId("nmP").value = "대전철도청";
  byId("nmW").value = "이상대 (용인시정연구원)";
  byId("nmMsg").textContent = "";
  await fire("nmSave", "click");
  const m = byId("nmMsg").textContent;
  if (/저장하는 중/.test(m)) throw new Error("「저장하는 중…」에서 멈췄습니다 (창이 안 닫힘)");
  if (/저장하지 못했습니다/.test(m)) throw new Error(m);
  if (byId("nModal").classList.contains("on")) throw new Error("창이 안 닫혔습니다");
  if (byId("nmSave").disabled) throw new Error("저장 단추가 잠긴 채 남았습니다");
});

await check("보낸 값에 일곱 칸이 다 있다", () => {
  const put = calls.filter((c) => c[0] === "insert").pop();
  if (!put) throw new Error("저장을 아예 안 했습니다");
  const v = put[1];
  const want = ["event_date", "event_time", "place", "tag", "contact", "people", "event"];
  const miss = want.filter((k) => !(k in v));
  if (miss.length) throw new Error("빠진 칸: " + miss.join(", "));
});

await check("취소를 누르면 닫힌다", async () => {
  await fire("nNew", "click");
  await fire("nmCancel", "click");
  if (byId("nModal").classList.contains("on")) throw new Error("안 닫혔습니다");
});

await check("붙임 파일 다시 읽기 단추가 살아 있다", () => fire("nmRe", "click"));
await check("요약 채우기 단추가 살아 있다", () => fire("nFill", "click"));
await check("엑셀 받기 단추가 살아 있다", () => fire("nXls", "click"));
await check("달력 단추가 살아 있다", () => fire("nCal", "click"));

// ── 목록 → 자세히 보기 → 고치기 → 제목 누르기 ──
await check("목록의 줄을 누르면 자세히 보기가 열린다", async () => {
  await fire("nrow__open-r1", "click");
  if (!byId("nDetail").classList.contains("on")) throw new Error("안 열렸습니다");
});

await check("고치기를 누르면 글쓰기 창이 열린다", async () => {
  await fire("ndEdit", "click");
  if (!byId("nModal").classList.contains("on")) throw new Error("글쓰기 창이 안 열렸습니다");
  if (byId("nDetail").classList.contains("on")) throw new Error("자세히 보기가 위에 남았습니다");
});

await check("글쓰기 창은 어디를 눌러도 사라지지 않는다", async () => {
  // 창 안이든 바깥 회색 바탕이든, 눌러서 닫히는 길이 아예 없어야 합니다
  const fns = listeners.get("nModal|click") || [];
  for (const t of [byId("nmT"), byId("nModal"), byId("nmB")]) {
    for (const fn of fns) await fn({ target: t, preventDefault() {} });
    if (!byId("nModal").classList.contains("on"))
      throw new Error(t.id + " 를 눌렀더니 창이 사라졌습니다");
  }
});

await check("자세히 보기를 여러 번 열어도 듣는 이가 쌓이지 않는다", async () => {
  await fire("nmCancel", "click");
  for (let i = 0; i < 5; i++) await fire("nrow__open-r1", "click");
  const stacked = (listeners.get("nDetail|click") || []).length;
  if (stacked) throw new Error("addEventListener 로 " + stacked + "개가 쌓였습니다");
  if (typeof byId("nDetail").onclick !== "function")
    throw new Error("바깥 누르면 닫기가 아예 없습니다");
});

console.log("─".repeat(60));
console.log(bad ? bad + "개 어긋났습니다" : "모두 지나갔습니다");
process.exit(bad ? 1 : 0);
