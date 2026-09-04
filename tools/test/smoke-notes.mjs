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
  /* value 와 innerHTML 은 그냥 칸이 아니라 <select> 시늉까지 냅니다.
     option 을 채워 둔 자리에 없는 값을 넣으면, 진짜 브라우저처럼 빈 값이 됩니다
     (selectedIndex = -1). 사람들 글을 열면 갈래가 ETC 로 갈리던 일이
     바로 이 때문이었습니다. */
  let _val = "", _html = "", _opts = null;
  const el = {
    id, textContent: "", hidden: false, disabled: false,
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
        // 담긴 글마다 한 줄씩 — 같은 id 면 같은 단추를 돌려줍니다
        return (globalThis.__rows || []).map((r) => {
          const b = byId(sel.replace(".", "") + "-" + r.id);
          b.dataset.id = r.id;
          return b;
        });
      }
      // 갈래 고르개 — Diary 를 눌러 놓은 상태를 만들 수 있게
      if (id === "nTabs" && sel === "button") {
        return ["all", "schedule", "diary"].map((k) => {
          const b = byId("ntab-" + k);
          b.dataset.k = k;
          return b;
        });
      }
      // 달력의 날짜 숫자 — 누르면 그날 일기를 씁니다
      if (id === "nCalBox" && /data-new/.test(sel)) {
        const b = makeEl("cday-20260826");
        b.dataset.new = "2026-08-26";
        return [b];
      }
      return [];
    },
    querySelector() { return makeEl(id + "-child"); },
    closest() { return makeEl(id + "-closest"); },
    appendChild() {}, remove() {}, focus() {}, click() {},
    setSelectionRange() {}, select() {}, blur() {},
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return _html; },
    set(h) {
      _html = String(h == null ? "" : h);
      const got = [];
      const re = /<option[^>]*\svalue="([^"]*)"/g;
      let m;
      while ((m = re.exec(_html))) got.push(m[1]);
      if (got.length || /<option/.test(_html)) _opts = got;
      if (_opts && _opts.length && _opts.indexOf(_val) < 0) _val = _opts[0];
    },
  });
  Object.defineProperty(el, "value", {
    get() { return _val; },
    set(v) {
      const t = v == null ? "" : String(v);
      _val = (_opts && _opts.length && _opts.indexOf(t) < 0) ? "" : t;
    },
  });
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
globalThis.location = { search: "", pathname: "/blog.html", replace() {} };
globalThis.history = { replaceState() {} };
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
  event: "2026 한국지방자치학회 하계국제학술대회", tag: "토론",
  files: [
    { name: "개최개요.jpg", path: "notes/1_a.jpg", type: "image", size: 388000 },
    { name: "발표자료.pdf", path: "notes/2_b.pdf", type: "pdf", size: 2400000 },
  ],
}, {
  /* 자료는 Schedule 말고 회의록에서도 올라옵니다 */
  id: "m1", category: "minutes", title: "방산클러스터 자문회의",
  body: "", event_date: "2026-08-30", place: "경기연구원", people: "이석준",
  files: [{ name: "명단.xlsx", path: "notes/3_c.xlsx", type: "excel", size: 12000 }],
}, {
  /* 사람들 글 — 손으로는 새로 못 쓰는 갈래입니다.
     이 글을 열어 저장해도 갈래가 딴 데로 가면 안 됩니다. */
  id: "p1", category: "people", title: "이석준 이천시청 군협력담당관",
  body: "[이석준] 이천시청 군협력담당관", event_date: null, people: "이석준",
  files: [],
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
    ' signedUrl: async () => "x", downloadUrl: async () => "x",' +
    ' remove: async () => {}, fileFromStore: async () => ({}) };');
  /* 올린 자료 모으기도 진짜를 씁니다 — 셈 자체는 tools/test/uploads.mjs 가 봅니다.
     notes-uploads.js 는 아무것도 들여오지 않아 그대로 심어 넣을 수 있습니다. */
  const upUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-uploads.js", "utf8")).toString("base64");
  s = s.replace(/^import \* as UP from "\.\/notes-uploads\.js[^"]*";$/m,
    "const UP = await import(" + JSON.stringify(upUrl) + ");");
  /* 셈 모듈은 시늉이 아니라 진짜를 씁니다 (셈 자체는 tools/test/stats.mjs 가 봅니다).
     data: 꼴 안에서는 상대 경로가 풀리지 않아, 소스를 그대로 심어 넣습니다.
     notes-stats.js 는 아무것도 들여오지 않아 이렇게 해도 됩니다. */
  const statsUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-stats.js", "utf8")).toString("base64");
  const briefUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-brief.js", "utf8")
      .replace(/^import \{ justName \} from "\.\/notes-stats\.js[^"]*";$/m,
        "const { justName } = await import(" + JSON.stringify(statsUrl) + ");"),
      "utf8").toString("base64");
  s = s.replace(/^import \{ readBrief \} from "\.\/notes-brief\.js[^"]*";$/m,
    "const { readBrief } = await import(" + JSON.stringify(briefUrl) + ");");
  /* 겹침 걷어내기도 진짜를 씁니다 — 셈 자체는 tools/test/cal-merge.mjs 가 봅니다 */
  const mergeUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/cal-merge.js", "utf8")).toString("base64");
  s = s.replace(/^import \{ dropMirrors \} from "\.\/cal-merge\.js[^"]*";$/m,
    "const { dropMirrors } = await import(" + JSON.stringify(mergeUrl) + ");");
  s = s.replace(/^import \* as ST from "\.\/notes-stats\.js[^"]*";$/m,
    "const ST = await import(" + JSON.stringify(statsUrl) + ");");
  /* 관계망은 시늉 — 그래프 셈은 tools/test/network.mjs 가 따로 봅니다.
     화면 쪽도 canvas 가 없으면 스스로 비켜서게 되어 있습니다. */
  s = s.replace(/^import \{[^}]*\} from "\.\/addressbook\.js[^"]*";$/m,
    "const alumniNames = async () => new Set();" +
    " const addrCards = async () => (globalThis.__cards || []);" +
    " const addrPhoto = async () => (globalThis.__photo || \"\");");
  /* 명함 짝짓기는 진짜를 씁니다 — 셈 자체는 tools/test/cards.mjs 가 봅니다.
     notes-stats.js 를 들여오므로 그것도 함께 심어 넣습니다. */
  const statsUrl0 = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-stats.js", "utf8")).toString("base64");
  const cardsUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-cards.js", "utf8")
      .replace(/^import \{ justName \} from "\.\/notes-stats\.js[^"]*";$/m,
        "const { justName } = await import(" + JSON.stringify(statsUrl0) + ");"),
      "utf8").toString("base64");
  s = s.replace(/^import \* as CD from "\.\/notes-cards\.js[^"]*";$/m,
    "const CD = await import(" + JSON.stringify(cardsUrl) + ");");
  s = s.replace(/^import \* as NW from "\.\/notes-network\.js[^"]*";$/m,
    "const NW = { buildGraph: () => ({ nodes: [], edges: [] }), layout: (g) => g };");
  /* 동경대 연결은 시늉 — 바깥 프로젝트라 시험 틀에서는 늘 비어 있습니다 */
  s = s.replace(/^import \* as UT from "\.\/utokyo\.js[^"]*";$/m,
    'const UT = { me: async () => null, signIn: async () => {}, signOut: async () => {},' +
    ' dayRecords: async () => ({ posts: [], comments: [], photos: [] }),' +
    ' postUrl: () => "#", albumUrl: () => "#", total: () => 0 };');
  s = s.replace(/^import \* as GC from "\.\/gcal\.js[^"]*";$/m,
    'const GC = { ready: () => false, connected: () => false, month: async () => [],' +
    ' connect: async () => {}, disconnect() {}, addEvent: async () => "" };');
  return import("data:text/javascript;base64," + Buffer.from(extra(s)).toString("base64"));
};

const M = await load("assets/js/notes.js");
await M.initNotes("notesapp");

const fire = async (id, ev, arg) => {
  const fns = [...(listeners.get(id + "|" + ev) || [])];   // 도는 사이에 늘어도 끝나게
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
await check("목록의 줄을 누르면 본문이 바로 열린다", async () => {
  await fire("nrow__open-r1", "click");
  if (!byId("nModal").classList.contains("on"))
    throw new Error("글 고치기 창이 안 열렸습니다 (자세히 보기에서 한 번 더 눌러야 합니까?)");
  if (byId("nDetail").classList.contains("on"))
    throw new Error("자세히 보기가 위에 남았습니다");
  if (byId("nmTitle").textContent !== "글 고치기")
    throw new Error("새 글 창이 열렸습니다 — " + byId("nmTitle").textContent);
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

await check("글을 여러 번 열어도 창이 멀쩡하다", async () => {
  await fire("nmCancel", "click");
  for (let i = 0; i < 5; i++) {
    await fire("nrow__open-r1", "click");
    await fire("nmCancel", "click");
  }
  await fire("nrow__open-r1", "click");
  if (!byId("nModal").classList.contains("on")) throw new Error("안 열렸습니다");
});

await check("창 위 저장 단추가 아래 저장을 부른다", async () => {
  fire("nNew", "click");
  byId("nmT").value = "위 단추 시험";
  const before = globalThis.__calls.length;
  await fire("nmSaveTop", "click");
  if (globalThis.__calls.length <= before) throw new Error("저장이 안 불렸습니다");
});

await check("창 위 취소·지우기 단추가 살아 있다", () => {
  if (!byId("nmXTop") || !byId("nmDelTop")) throw new Error("단추가 없습니다");
});

// ── 달력에서 그날 일기 쓰기 ──
await check("달력 날짜를 누르면 그날 일기 창이 열린다", async () => {
  await fire("ntab-diary", "click");                 // Diary 갈래를 보고 있을 때
  await fire("nCal", "click");                       // 달력을 펴 놓습니다
  await fire("cday-20260826", "click");
  if (byId("nmD").value !== "2026.08.26")
    throw new Error("날짜 칸이 " + byId("nmD").value);
  if (byId("nmCat").value !== "diary")
    throw new Error("갈래가 " + byId("nmCat").value);
  if (byId("nmT").value !== "2026.08.26 (수)")
    throw new Error("제목이 " + byId("nmT").value + " (오늘로 찍혔습니다)");
});

await check("그냥 글쓰기는 오늘로 열린다", async () => {
  await fire("nmCancel", "click");
  await fire("nNew", "click");
  byId("nmCat").value = "diary";
  await fire("nmCat", "change");
  const t = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  const want = t.getFullYear() + "." + p2(t.getMonth() + 1) + "." + p2(t.getDate());
  if (!byId("nmT").value.startsWith(want))
    throw new Error("제목이 " + byId("nmT").value + " · 오늘은 " + want);
  if (byId("nmD").value !== want)
    throw new Error("날짜 칸이 " + byId("nmD").value);
});

// ── (사람) 메모 → 사람들 게시판 ──
await check("(사람) 메모가 사람들 글로 쌓인다", async () => {
  const NL2 = String.fromCharCode(10);
  await fire("nmCancel", "click");
  await fire("nNew", "click");
  byId("nmCat").value = "schedule";
  await fire("nmCat", "change");
  byId("nmT").value = "[자문회의] 이천시청_청미천 드론훈련장";
  byId("nmB").value = "(사람) 이석준 이천시청 군협력담당관" + NL2 +
                      "넘 감사드립니다. 참 따뜻한 분이시다.";
  byId("nmD").value = "2026.08.25";
  byId("nmE").value = "이천 드론교육원 자문회의";
  byId("nmP").value = "청미천 드론훈련장";
  byId("nmW").value = "이석준, 강한구";
  byId("nmTm").value = ""; byId("nmC").value = "";
  byId("nmMsg").textContent = "";
  calls.length = 0;
  await fire("nmSave", "click");
  /* 그 사람의 글이 이미 있으면 이어 붙이고(update), 없으면 새로 만듭니다(insert) */
  const put = calls.filter((c) =>
    (c[0] === "insert" && c[1].category === "people") ||
    (c[0] === "update" && /^\[이석준\]/.test(String(c[1].body || "")))).pop();
  if (!put) throw new Error("사람들 글을 안 만들었습니다");
  const b = String(put[1].body || "");
  if (!b.startsWith("[이석준] "))
    throw new Error("첫 줄이 「" + b.split(NL2)[0] + "」");
  const src = "2026.08.25_이천 드론교육원 자문회의_이석준, 강한구_청미천 드론훈련장";
  if (b.indexOf(src) < 0) throw new Error("출처 줄이 없습니다: " + JSON.stringify(b));
  if (b.indexOf("따뜻한 분이시다") < 0) throw new Error("느낌이 안 담겼습니다");
  if (b.split(NL2)[1] !== "") throw new Error("첫 줄 뒤에 빈 줄이 없습니다");
});

// ── 사람들 글은 갈래가 흔들리지 않아야 합니다 ──
await check("사람들 글을 열어도 갈래가 ETC 로 갈리지 않는다", async () => {
  await fire("nmCancel", "click");
  await fire("nrow__open-p1", "click");
  if (byId("nmCat").value !== "people")
    throw new Error("갈래가 「" + byId("nmCat").value + "」 로 열렸습니다");
});

await check("사람들 글을 저장해도 사람들에 남는다", async () => {
  calls.length = 0;
  byId("nmMsg").textContent = "";
  await fire("nmSave", "click");
  const put = calls.filter((c) => c[0] === "update").pop();
  if (!put) throw new Error("저장을 안 했습니다 — " + byId("nmMsg").textContent);
  if (put[1].category !== "people")
    throw new Error("갈래가 「" + put[1].category + "」 로 저장됐습니다");
});

/* ── Uploads — 여러 게시판에 흩어진 자료를 한자리에 ──
   붙임이 있는 글을 여럿 두고, 그 화면이 터지지 않고 그려지는지 봅니다.
   셈 자체는 tools/test/uploads.mjs 가 따로 봅니다. */
await check("Uploads 화면이 그려진다", async () => {
  globalThis.location.search = "?cat=uploads";
  await M.initNotes("notesapp");
  const html = byId("nList").innerHTML || "";
  if (!html.includes("urow")) throw new Error("자료 줄이 없습니다 — " + html.slice(0, 120));
  for (const n of ["개최개요.jpg", "발표자료.pdf", "명단.xlsx"])
    if (!html.includes(n)) throw new Error("「" + n + "」 이 안 보입니다");
});

await check("어느 게시판에서 온 자료인지 보인다", () => {
  const html = byId("nList").innerHTML || "";
  for (const n of ["Schedule", "회의록"])
    if (!html.includes(n)) throw new Error("「" + n + "」 이름표가 없습니다");
  if (!html.includes("uchip")) throw new Error("게시판 거르개가 없습니다");
});

await check("자료 수와 크기를 알려 준다", () => {
  const t = byId("nCount").textContent || "";
  if (!/자료 3개/.test(t)) throw new Error("셈이 이상합니다 — " + t);
  if (!/MB|KB/.test(t)) throw new Error("크기가 없습니다 — " + t);
});

await check("종류 거르개가 놓인다", () => {
  const html = byId("nPeopleSw").innerHTML || "";
  for (const n of ["전체", "그림", "PDF", "표"])
    if (!html.includes(n)) throw new Error("「" + n + "」 단추가 없습니다");
  if (byId("nPeopleSw").hidden) throw new Error("거르개가 숨겨져 있습니다");
});

console.log("─".repeat(60));
console.log(bad ? bad + "개 어긋났습니다" : "모두 지나갔습니다");
process.exit(bad ? 1 : 0);
