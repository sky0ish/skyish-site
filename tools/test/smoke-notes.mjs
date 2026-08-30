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
    querySelectorAll() { return []; },
    querySelector() { return makeEl(id + "-child"); },
    closest() { return makeEl(id + "-closest"); },
    appendChild() {}, remove() {}, focus() {}, click() {},
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
const sbStub = `export const sb = {
  from: () => { const q = {
    select: () => q, order: () => q, eq: () => q,
    insert: (v) => { globalThis.__calls.push(["insert", v]); return q; },
    update: (v) => { globalThis.__calls.push(["update", v]); return q; },
    delete: () => { globalThis.__calls.push(["delete"]); return q; },
    then: (res) => Promise.resolve({ data: [], error: null, count: 0 }).then(res),
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

console.log("─".repeat(60));
console.log(bad ? bad + "개 어긋났습니다" : "모두 지나갔습니다");
process.exit(bad ? 1 : 0);
