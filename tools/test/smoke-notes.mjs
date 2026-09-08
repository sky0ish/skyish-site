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
        return ["all", "schedule", "diary", "uploads"].map((k) => {
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
    appendChild() {}, remove() {}, focus() {},
    /* 진짜 브라우저처럼 듣는 이를 부릅니다.
       전에는 빈 함수라, 위 저장 단추가 저장을 두 번 부르는 것을
       시험이 못 잡았습니다 (달력에 같은 일정이 두 번 뜨던 버그). */
    click() {
      const fns = [...(listeners.get(id + "|click") || [])];
      const ev = { target: el, currentTarget: el, preventDefault() {} };
      fns.forEach((fn) => fn(ev));
    },
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
globalThis.location = { search: "", pathname: "/blog.html",
  href: "https://skyish.kr/blog.html", replace(u) { location.__went = u; } };
globalThis.history = { replaceState() {} };
globalThis.alert = (m) => alerts.push(String(m));
globalThis.confirm = (m) => { confirms.push(String(m)); return true; };
/* 진짜 URL 을 그대로 두고 blob 만 덧붙입니다 —
   통째로 갈아 끼웠더니 new URL(location.href) 가 터졌습니다
   (게시판이 주소에서 ?id=·?new= 를 걷어 낼 때 씁니다). */
const RealURL = globalThis.URL;
RealURL.createObjectURL = () => "blob:x";
RealURL.revokeObjectURL = () => {};
globalThis.Blob = class {};
globalThis.File = class { constructor(p, n) { this.name = n; this.size = 1; } };

/* ── 폴더 고르기 시늉 (회의록 붙이기용) ──
   globalThis.__dirs 에 {폴더이름: [파일이름…]} 을 넣어 두면
   showDirectoryPicker 가 그것을 돌려줍니다. */
const fakeFile = (name) => ({
  kind: "file", name,
  getFile: async () => ({
    name, size: 10,
    text: async () => (globalThis.__text || {})[name] || "",
  }),
});
globalThis.window = globalThis;      // notes.js 가 window.showDirectoryPicker 를 봅니다
/* 회의 폴더 안에 「pictures」 폴더를 두고 싶으면
   globalThis.__pics 에 {폴더이름: [사진이름…]} 을 넣습니다. */
globalThis.showDirectoryPicker = async () => ({
  async *values() {
    for (const [dname, files] of Object.entries(globalThis.__dirs || {})) {
      const pics = (globalThis.__pics || {})[dname] || [];
      const pres = (globalThis.__pres || {})[dname] || [];
      yield {
        kind: "directory", name: dname,
        /* 개최개요.json 을 놓아 두는 길 — 무엇을 썼는지 기억해 둡니다 */
        getFileHandle: async (nm) => ({
          name: nm,
          createWritable: async () => ({
            write: async (v) => { (globalThis.__wrote ||= {})[dname + "/" + nm] = v; },
            close: async () => {},
          }),
        }),
        async *values() {
          for (const f of files) yield fakeFile(f);
          if (pics.length) yield {
            kind: "directory", name: "pictures",
            async *values() { for (const p of pics) yield fakeFile(p); },
          };
          if (pres.length) yield {
            kind: "directory", name: "presentation",
            async *values() { for (const p of pres) yield fakeFile(p); },
          };
        },
      };
    }
  },
});

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
  from: (tbl) => { const q = {
    select: () => q, order: () => q, eq: () => q,
    limit: () => q, single: () => q, in: () => q, is: () => q, or: () => q,
    insert: (v) => { globalThis.__calls.push(["insert", v]); return q; },
    update: (v) => { globalThis.__calls.push(["update", v]); return q; },
    delete: () => { globalThis.__calls.push(["delete"]); return q; },
    then: (res) => Promise.resolve({
      /* 앨범 표는 따로 — notes 의 글을 앨범인 줄 알면 안 됩니다 */
      data: /^gallery_/.test(String(tbl || "")) ? (globalThis.__albums || []) : globalThis.__rows,
      error: null, count: 0,
    }).then(res),
  }; return q; },
  rpc: async () => ({ data: true, error: null }),
  storage: { from: (b) => ({
    upload: async (p) => { (globalThis.__gal ||= []).push(b + "/" + p); return { error: null }; },
    getPublicUrl: (p) => ({ data: { publicUrl: "https://x/" + p } }),
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
    'const NF = { kind: () => "file", niceSize: () => "1B",' +
    /* 진짜 mergePeople 처럼 이름을 더합니다 — (a) => a 로 두면
       회의록 붙이기의 「만난 사람」 이 늘 비어 시험이 헛돕니다 */
    ' mergePeople: (cur, add) => { const have = String(cur || "").split(/\s*,\s*/).filter(Boolean);' +
    ' (add || []).forEach((n) => { if (!have.includes(n)) have.push(n); }); return have.join(", "); },' +
    ' extract: async () => ({ total: 0, mine: [], head: [], people: [], event: "" }),' +
    ' asText: () => "", filesFrom: () => [],' +
    /* 올린 파일의 이름·경로를 진짜처럼 돌려줍니다 — 이것이 글의 붙임이 됩니다 */
    ' upload: async (f) => ({ name: (f && f.name) || "", path: "notes/" + ((f && f.name) || ""), type: "file", size: 10 }),' +
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
    ' const addrPhoto = async () => (globalThis.__photo || "");' +
    " const addrSavePhoto = async () => true;" +
    ' const addrToFolder = async () => "";');
  /* 회의록 폴더 읽기도 진짜를 씁니다 — 셈 자체는 tools/test/minutes.mjs 가 봅니다.
     notes-brief.js 를 들여오므로 그것도 함께 심어 넣습니다. */
  const mnUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-minutes.js", "utf8")
      .replace(/^import \{ looksLikeName \} from "\.\/notes-brief\.js[^"]*";$/m,
        "const { looksLikeName } = await import(" + JSON.stringify(briefUrl) + ");"),
      "utf8").toString("base64");
  s = s.replace(/^import \* as MN from "\.\/notes-minutes\.js[^"]*";$/m,
    "const MN = await import(" + JSON.stringify(mnUrl) + ");");
  /* 얼굴 자르기 셈도 진짜를 씁니다 — 셈 자체는 tools/test/facetag.mjs 가 봅니다 */
  const ftUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-facetag.js", "utf8")).toString("base64");
  s = s.replace(/^import \* as FT from "\.\/notes-facetag\.js[^"]*";$/m,
    "const FT = await import(" + JSON.stringify(ftUrl) + ");");
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
  /* 단체사진 고르기 — 고르는 규칙(pickBest)은 진짜를 쓰고,
     얼굴 세기만 시늉합니다 (globalThis.__faces 에 {사진이름: 얼굴수}). */
  const ppUrl = "data:text/javascript;base64," +
    Buffer.from(readFileSync(REPO + "/assets/js/notes-photo-pick.js", "utf8")).toString("base64");
  s = s.replace(/^import \* as PP from "\.\/notes-photo-pick\.js[^"]*";$/m,
    "const PPreal = await import(" + JSON.stringify(ppUrl) + ");" +
    "const PP = { ...PPreal, bestPhoto: async (cand) => {" +
    "  globalThis.__cand = cand.map((c) => c.name);" +
    "  const list = cand.map((c) => ({ name: c.name, file: c.file," +
    "    faces: (globalThis.__faces || {})[c.name] ?? -1, w: 100, h: 100 }));" +
    "  return { best: PPreal.pickBest(list), list };" +
    "} };");
  s = s.replace(/^import \* as GC from "\.\/gcal\.js[^"]*";$/m,
    'const GC = { ready: () => false, connected: () => false, month: async () => [],' +
    ' connect: async () => {}, disconnect() {}, addEvent: async () => "",' +
    ' deleteEvent: async (id, cal) => { globalThis.__gdel = [id, cal]; return true; } };');
  return import("data:text/javascript;base64," + Buffer.from(extra(s)).toString("base64"));
};

const M = await load("assets/js/notes.js");
await M.initNotes("notesapp");

const fire = async (id, ev, arg) => {
  const fns = [...(listeners.get(id + "|" + ev) || [])];   // 도는 사이에 늘어도 끝나게
  if (!fns.length) throw new Error(`${id} 의 ${ev} 를 아무도 듣고 있지 않습니다`);
  for (const fn of fns) await fn(arg || { target: byId(id), currentTarget: byId(id), preventDefault() {} });
};

/* 마지막으로 그 갈래에 넣은 글 — 이제 회의록 게시판에도 함께 넣으므로
   그냥 마지막 insert 를 집으면 엉뚱한 글을 봅니다. */
const lastInsert = (cat) => {
  const v = calls.filter((c) => c[0] === "insert" && c[1] && c[1].category === cat).pop();
  return (v || [])[1] || {};
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
  await fire("nmCancel", "click");
  await fire("ntab-uploads", "click");
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

await check("분류 거르개가 놓인다", () => {
  const html = byId("nPeopleSw").innerHTML || "";
  /* 회의록·개최개요·Pictures·자료 — 있는 것만 나옵니다 (전체는 늘) */
  if (!html.includes("전체")) throw new Error("「전체」 단추가 없습니다");
  if (!/회의록|개최개요|Pictures|자료/.test(html))
    throw new Error("분류 단추가 하나도 없습니다 — " + html.slice(0, 120));
  if (byId("nPeopleSw").hidden) throw new Error("거르개가 숨겨져 있습니다");
});

await check("줄 맨 앞에 분류가 붙는다", () => {
  const html = byId("nList").innerHTML || "";
  if (!html.includes("ukind")) throw new Error("분류 이름표가 없습니다");
  if (!/회의록|개최개요|Pictures|자료/.test(html))
    throw new Error("분류 이름이 안 보입니다");
});

/* ── 위 저장 단추가 한 번만 저장해야 합니다 ──
   창 위 「저장」 은 아래 「저장」 과 같은 일을 합니다. 전에는 아래 단추의
   손을 직접 부르고 그다음 진짜 클릭까지 보내서, 브라우저에서 글이 두 줄
   들어갔습니다. 달력에 같은 일정이 두 번 뜨던 바로 그 까닭입니다. */
await check("창 위 저장을 눌러도 한 번만 저장한다", async () => {
  await fire("nmCancel", "click");
  await fire("nNew", "click");
  byId("nmT").value = "건설국미팅.";
  byId("nmCat").value = "schedule";
  await fire("nmCat", "change");
  calls.length = 0;
  await fire("nmSaveTop", "click");
  const puts = calls.filter((c) => c[0] === "insert" || c[0] === "update");
  if (puts.length !== 1)
    throw new Error(puts.length + "번 저장했습니다 (한 번이어야 합니다)");
});

/* ── 회의록 붙이기 ──
   1.회의록 은 회의 하나가 폴더 하나입니다. 같은 날 회의가 둘일 때
   뒤엣것이 앞엣것을 덮어쓰던 일이 있었습니다 — 여기서 잡습니다. */
await check("회의록 폴더를 훑어 그날 글에 붙인다", async () => {
  globalThis.__dirs = {
    "20260901_경기연구원_이석준": ["20260901_경기연구원_이석준_회의록.pdf"],
  };
  globalThis.__text = {};
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 50));
  const ins = calls.filter((c) => c[0] === "insert");
  if (!ins.length) throw new Error("아무것도 안 넣었습니다 — " + alerts[alerts.length - 1]);
  const v = lastInsert("schedule");
  if (v.event_date !== "2026-09-01") throw new Error("날짜가 " + v.event_date);
  if (v.category !== "schedule") throw new Error("갈래가 " + v.category);
  if (v.tag !== "업무회의") throw new Error("말머리가 " + v.tag);
  if (!/이석준/.test(v.people || "")) throw new Error("만난 사람이 " + v.people);
  if (v.place !== "경기연구원") throw new Error("장소가 " + v.place);
});

await check("요약 덩이에 「━ 파일이름」 머리글이 붙는다", async () => {
  globalThis.__dirs = {
    "20260904_어디_아무개": ["20260904_어디_아무개_회의록.pdf",
                             "20260904_어디_아무개.txt"],
  };
  globalThis.__text = { "20260904_어디_아무개.txt": "요약입니다" + String.fromCharCode(10) + "■ 전문" };
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 50));
  const v = lastInsert("schedule");
  if (!/━ 20260904_어디_아무개_회의록\.pdf/.test(v.body || ""))
    throw new Error("머리글이 없습니다 — " + JSON.stringify(v.body));
});

await check("같은 날 회의가 둘이면 글은 하나에 두 건", async () => {
  globalThis.__dirs = {
    "20260902_오전_강은호": ["20260902_오전_강은호_회의록.pdf"],
    "20260902_오후_김병규": ["20260902_오후_김병규_회의록.pdf"],
  };
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 50));
  const ins = calls.filter((c) => c[0] === "insert" && c[1] && c[1].category === "schedule");
  if (ins.length !== 1)
    throw new Error(ins.length + "개의 일정 글을 만들었습니다 (하루에 하나여야 합니다)");
  const v = ins[0][1];
  if ((v.files || []).length !== 2)
    throw new Error("붙임이 " + (v.files || []).length + "개입니다 (둘이어야 합니다)");
  for (const who of ["강은호", "김병규"])
    if (!(v.people || "").includes(who))
      throw new Error(who + " 이 만난 사람에 없습니다 — " + v.people);
});

/* 「사진중에 얼굴개수가 가장 많은 단체사진만 1장 올리면 되」 */
await check("사진 폴더가 있으면 단체사진 한 장을 함께 올린다", async () => {
  globalThis.__dirs = { "20260831_비스트로미_이소라": ["20260831_비스트로미_이소라_회의록.pdf"] };
  globalThis.__pics = { "20260831_비스트로미_이소라": ["혼자.jpg", "단체.jpg", "둘이.jpg"] };
  globalThis.__faces = { "혼자.jpg": 1, "단체.jpg": 7, "둘이.jpg": 2 };
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const v = lastInsert("schedule");
  const names = (v.files || []).map((f) => f.name);
  if (names.length !== 2)
    throw new Error("붙임이 " + names.length + "개입니다 (회의록 + 사진 둘이어야 합니다) — " + names);
  if (!names.some((n) => /회의록\.pdf$/.test(n)))
    throw new Error("회의록이 없습니다 — " + names);
  if (!names.includes("단체.jpg"))
    throw new Error("얼굴이 가장 많은 사진이 아닙니다 — " + names);
});

await check("사진 폴더에 그림이 아닌 것이 섞여도 안 올린다", async () => {
  globalThis.__dirs = { "20260903_어디_아무개": ["20260903_어디_아무개_회의록.pdf"] };
  globalThis.__pics = { "20260903_어디_아무개": ["메모.txt", "녹음.m4a", "단체.jpg"] };
  globalThis.__faces = { "단체.jpg": 4 };
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const v = lastInsert("schedule");
  const names = (v.files || []).map((f) => f.name);
  if (names.some((n) => /\.(txt|m4a)$/.test(n)))
    throw new Error("그림이 아닌 것이 올라갔습니다 — " + names);
  if (!names.includes("단체.jpg")) throw new Error("사진이 안 올라갔습니다 — " + names);
  /* 고르는 자리까지도 그림만 와야 합니다 — 아니면 큰 txt 가 뽑힐 수 있습니다 */
  const cand = globalThis.__cand || [];
  if (cand.some((n) => /\.(txt|m4a)$/.test(n)))
    throw new Error("그림이 아닌 것이 고르기까지 왔습니다 — " + cand);
});

await check("발표자료(final)도 함께 올린다", async () => {
  globalThis.__dirs = { "20260902_발표_서민호": [
    "20260902_발표_서민호_회의록.pdf",
    "자문회의 개최건의(9월2일).pdf",
    "환승역세권과 주거공급_260902_final.pdf",
  ] };
  globalThis.__pics = {};
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const v = lastInsert("schedule");
  const names = (v.files || []).map((f) => f.name);
  if (!names.some((n) => /_회의록\.pdf$/.test(n)))
    throw new Error("회의록이 없습니다 — " + names);
  if (!names.includes("환승역세권과 주거공급_260902_final.pdf"))
    throw new Error("발표자료가 없습니다 — " + names);
  if (names.some((n) => /개최건의/.test(n)))
    throw new Error("개최건의까지 올라갔습니다 — " + names);
});

/* 「회의록 폴더에서 presentation 폴더가 있을 경우에 …
    회의록 파일을 만들어주면서 동시에 presentation파일도 upload로 올려줘」 */
await check("presentation 폴더의 발표자료도 함께 올린다", async () => {
  globalThis.__dirs = { "20260908_김병규": ["20260908_김병규_회의록.pdf"] };
  globalThis.__pics = {};
  globalThis.__pres = { "20260908_김병규": [
    "(김병규)(260908)국방_피지컬AI_세미나.pptx",
    "(김병규)(260908)국방_피지컬AI_세미나.pdf",
  ] };
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const v = lastInsert("schedule");
  const names = (v.files || []).map((f) => f.name);
  if (names.length !== 2)
    throw new Error("붙임이 " + names.length + "개입니다 (회의록 + 발표자료) — " + names);
  if (!names.includes("(김병규)(260908)국방_피지컬AI_세미나.pdf"))
    throw new Error("PDF 가 아닙니다 — " + names);
  if (names.some((n) => /\.pptx$/i.test(n)))
    throw new Error("pptx 까지 올라갔습니다 — " + names);
});

await check("발표자료·사진·회의록이 다 있으면 셋 다", async () => {
  globalThis.__dirs = { "20260909_김병규": ["20260909_김병규_회의록.pdf"] };
  globalThis.__pics = { "20260909_김병규": ["단체.jpg", "혼자.jpg"] };
  globalThis.__faces = { "단체.jpg": 6, "혼자.jpg": 1 };
  globalThis.__pres = { "20260909_김병규": ["발표_final.pdf"] };
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const v = lastInsert("schedule");
  const names = (v.files || []).map((f) => f.name).sort();
  if (names.length !== 3)
    throw new Error("붙임이 " + names.length + "개입니다 (셋이어야 합니다) — " + names);
  for (const want of ["20260909_김병규_회의록.pdf", "단체.jpg", "발표_final.pdf"])
    if (!names.includes(want)) throw new Error(want + " 가 없습니다 — " + names);
});

/* 「음성파일만있고, 개최개요가 없을 경우, 내가 schedule상에 참석자 명단을
    적어줬다면, 개최개요를 니가 확인해서 sample대로 회의록 작성」 */
await check("개최개요가 없으면 일정에서 만들어 폴더에 놓는다", async () => {
  globalThis.__rows = [{
    id: "s1", category: "schedule", title: "평택역개발 BT",
    event_date: "2026-09-08", event_time: "14:00", place: "평택시청",
    people: "김병규, 김성일, 박현호", event: "평택1구역 재개발 정비계획", files: [],
  }];
  globalThis.__dirs = { "20260908_평택역개발_BT": ["음성 260908.m4a"] };
  globalThis.__pics = {}; globalThis.__pres = {};
  globalThis.__wrote = {};
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const w = globalThis.__wrote["20260908_평택역개발_BT/개최개요.json"];
  if (!w) throw new Error("개최개요를 안 놓았습니다 — " + JSON.stringify(globalThis.__wrote));
  const v = JSON.parse(w);
  if (v["외부"] !== "김병규, 김성일, 박현호") throw new Error("참석자가 다릅니다 — " + w);
  if (v["장소"] !== "평택시청") throw new Error("장소가 다릅니다 — " + w);
  if (!/2026년 9월8일/.test(v["일시"] || "")) throw new Error("일시가 다릅니다 — " + w);
});

await check("일정 글이 없어도 폴더 이름으로 개최개요를 만든다", async () => {
  globalThis.__rows = [];                       // 그날 일정 글이 없습니다
  globalThis.__dirs = { "20260907_한국건설기술연구원_김인호_차용운": ["음성 260907.m4a"] };
  globalThis.__pics = {}; globalThis.__pres = {};
  globalThis.__wrote = {};
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const w = globalThis.__wrote["20260907_한국건설기술연구원_김인호_차용운/개최개요.json"];
  if (!w) throw new Error("개최개요를 안 놓았습니다 — " + JSON.stringify(globalThis.__wrote));
  const v = JSON.parse(w);
  if (v["장소"] !== "한국건설기술연구원") throw new Error("장소가 " + v["장소"]);
  if (!/김인호/.test(v["외부"] || "")) throw new Error("참석자가 " + v["외부"]);
  if (!/폴더 이름/.test(v["출처"] || "")) throw new Error("출처가 " + v["출처"]);
});

await check("개최개요가 이미 있으면 손대지 않는다", async () => {
  globalThis.__dirs = { "20260908_평택역개발_BT": [
    "음성 260908.m4a", "회의개최개요.pdf",
  ] };
  globalThis.__wrote = {};
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  if (Object.keys(globalThis.__wrote).length)
    throw new Error("덮어썼습니다 — " + JSON.stringify(globalThis.__wrote));
});

await check("회의록 게시판에도 따로 모인다", async () => {
  globalThis.__rows = [];
  globalThis.__dirs = { "20260910_어디_아무개": ["20260910_어디_아무개_회의록.pdf"] };
  globalThis.__pics = {}; globalThis.__pres = {}; globalThis.__wrote = {};
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 80));
  const ins = calls.filter((c) => c[0] === "insert").map((c) => c[1]);
  const cats = ins.map((v) => v.category).sort();
  if (!cats.includes("minutes"))
    throw new Error("회의록 게시판에 안 올렸습니다 — " + JSON.stringify(cats));
  if (!cats.includes("schedule"))
    throw new Error("일정에 안 올렸습니다 — " + JSON.stringify(cats));
  const m = ins.find((v) => v.category === "minutes");
  if (!(m.files || []).some((f) => /_회의록\.pdf$/.test(f.name)))
    throw new Error("회의록 파일이 안 붙었습니다 — " + JSON.stringify(m.files));
});

/* 「pictures에 사진이 많은건 앨범에 자동으로 넣어줘. 앨범 이름은 폴더명으로」 */
await check("사진이 많으면 앨범에도 담고 이름은 폴더 이름", async () => {
  globalThis.__rows = [];
  globalThis.__dirs = { "20260911_어디_아무개": ["20260911_어디_아무개_회의록.pdf"] };
  globalThis.__pics = { "20260911_어디_아무개": ["가.jpg", "나.jpg", "다.jpg", "라.jpg"] };
  globalThis.__faces = { "가.jpg": 2, "나.jpg": 7, "다.jpg": 1, "라.jpg": 3 };
  globalThis.__pres = {}; globalThis.__gal = [];
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 120));
  const al = calls.filter((c) => c[0] === "insert" && c[1] && c[1].title === "20260911_어디_아무개");
  if (!al.length) throw new Error("앨범을 안 만들었습니다");
  if ((globalThis.__gal || []).length !== 4)
    throw new Error("앨범에 담은 사진이 " + (globalThis.__gal || []).length + "장입니다");
  /* 일정 글에는 단체사진 한 장만 */
  const v = lastInsert("schedule");
  const names = (v.files || []).map((f) => f.name);
  if (names.filter((n) => /\.jpg$/.test(n)).length !== 1)
    throw new Error("일정 글에 사진이 여러 장 붙었습니다 — " + names);
  if (!names.includes("나.jpg")) throw new Error("단체사진이 아닙니다 — " + names);
});

await check("사진이 적으면 앨범은 안 만든다", async () => {
  globalThis.__dirs = { "20260912_어디_아무개": ["20260912_어디_아무개_회의록.pdf"] };
  globalThis.__pics = { "20260912_어디_아무개": ["가.jpg", "나.jpg"] };
  globalThis.__faces = { "가.jpg": 2, "나.jpg": 5 };
  globalThis.__gal = [];
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 80));
  if ((globalThis.__gal || []).length)
    throw new Error("앨범에 담았습니다 — " + globalThis.__gal.join(","));
});

await check("사진 폴더가 없으면 회의록만 올린다", async () => {
  globalThis.__dirs = { "20260901_어디_아무개": ["20260901_어디_아무개_회의록.pdf"] };
  globalThis.__pics = {};
  globalThis.__pres = {};
  calls.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const v = lastInsert("schedule");
  if ((v.files || []).length !== 1)
    throw new Error("붙임이 " + (v.files || []).length + "개입니다 — " + JSON.stringify(v.files));
});

await check("어느 사진을 왜 골랐는지 알려 준다", async () => {
  globalThis.__dirs = { "20260902_어디_아무개": ["20260902_어디_아무개_회의록.pdf"] };
  globalThis.__pics = { "20260902_어디_아무개": ["가.jpg", "나.jpg"] };
  globalThis.__faces = { "가.jpg": 2, "나.jpg": 9 };
  alerts.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 60));
  const last = alerts[alerts.length - 1] || "";
  if (!/단체사진/.test(last) || !/나\.jpg/.test(last) || !/9명/.test(last))
    throw new Error("까닭이 없습니다 — " + last);
});

await check("회의록 PDF 가 없는 폴더는 왜 건너뛰는지 알려 준다", async () => {
  globalThis.__dirs = { "20260903_어디_아무개": ["자문회의 개최건의.pdf"] };
  calls.length = 0;
  alerts.length = 0;
  await fire("nRec", "click");
  await new Promise((r) => setTimeout(r, 50));
  if (calls.some((c) => c[0] === "insert")) throw new Error("글을 만들었습니다");
  const last = alerts[alerts.length - 1] || "";
  if (!/회의록\.pdf/.test(last)) throw new Error("까닭을 안 알려 줍니다 — " + last);
});

console.log("─".repeat(60));
console.log("삭제 단추");

/* 「스케쥴이 삭제를 눌러도 삭제가 안되」 —
   구글에서 옮겨 온 새 글은 지울 「글」 이 없어 단추가 꺼져 있었습니다.
   이제 늘 눌리고, 누르면 지울 것이 있으면 지우고 없으면 까닭을 알려 줍니다. */
await check("새 글에서도 삭제 단추가 눌린다", async () => {
  await fire("nNew", "click");
  if (byId("nmDelTop").disabled) throw new Error("아직도 꺼져 있습니다");
});

await check("아무 데도 저장 안 된 새 글이면 까닭을 알려 준다", async () => {
  alerts.length = 0;
  await fire("nNew", "click");
  await fire("nmDel", "click");
  const last = alerts[alerts.length - 1] || "";
  if (!/지울 것이 없습니다/.test(last)) throw new Error("아무 말이 없습니다 — " + last);
});

/* 앱 달력에서 구글 일정을 눌러 들어오면 「삭제」 가 구글 쪽을 지웁니다 —
   여기 글은 아직 없으니 그것 말고는 지울 것이 없습니다. */
await check("구글에서 온 일정은 삭제가 구글 쪽을 지운다", async () => {
  location.search = "?cat=schedule&new=2026-09-14&gt=%EB%AE%A4%EC%BD%98" +
                    "&gid=evt777&gc=cal%40group.calendar.google.com&back=app";
  location.href = "https://skyish.kr/blog.html" + location.search;
  globalThis.__gdel = null;
  confirms.length = 0;
  await M.initNotes("notesapp");
  await fire("nmDel", "click");
  if (!confirms.some((c) => /구글 캘린더에서/.test(c)))
    throw new Error("여쭙지 않았습니다 — " + confirms.join(" / "));
  if (!globalThis.__gdel || globalThis.__gdel[0] !== "evt777")
    throw new Error("구글에 지우라고 안 했습니다 — " + JSON.stringify(globalThis.__gdel));
  if (globalThis.__gdel[1] !== "cal@group.calendar.google.com")
    throw new Error("어느 캘린더인지 안 넘겼습니다 — " + JSON.stringify(globalThis.__gdel));
});

console.log("─".repeat(60));
console.log("달력에서 넘어온 주소 (앱 → 게시판)");

/* 회색 상자 줄과 달력 칸이 만드는 주소를 게시판이 제대로 받는지.
   「눌렀더니 게시글이 아니라 달력이 나온다」 를 되풀이하지 않기 위한 시험입니다. */
const goTo = async (qs) => {
  location.search = qs;
  location.href = "https://skyish.kr/blog.html" + qs;
  alerts.length = 0;
  await M.initNotes("notesapp");
};

await check("구글 일정을 누르면 제목·시각이 채워진 새 일정 창이 열린다", async () => {
  await goTo("?cat=schedule&new=2026-09-07" +
             "&gt=%EC%B0%A9%EC%88%98%EC%8B%AC%EC%9D%98&gtm=14%3A00&gp=%EA%B2%BD%EA%B8%B0&back=app");
  if (byId("nmT").value !== "착수심의")
    throw new Error("제목이 안 채워졌습니다 — " + byId("nmT").value);
  if (byId("nmTm").value !== "14:00") throw new Error("시각이 안 채워졌습니다");
  if (byId("nmP").value !== "경기") throw new Error("장소가 안 채워졌습니다");
});

await check("글을 열었으면 그 뒤에서 달력을 펴지 않는다", async () => {
  /* 앞선 시험에서 달력 단추를 눌러 놓았을 수 있으니 접어 두고 봅니다 */
  byId("nCalBox").hidden = true;
  await goTo("?cat=schedule&new=2026-09-07&gt=%EB%AC%B4%EC%96%B8%EA%B0%80");
  if (!byId("nCalBox").hidden)
    throw new Error("글을 열어 놓고 달력까지 폈습니다 — 창을 닫으면 달력이 나타납니다");
});

await check("없는 글을 가리키면 까닭을 알려 준다", async () => {
  await goTo("?cat=schedule&id=없는번호");
  if (!alerts.some((a) => /찾지 못했/.test(a)))
    throw new Error("말없이 지나갔습니다 — 눌렀는데 달력만 나옵니다");
});

console.log("─".repeat(60));
console.log(bad ? bad + "개 어긋났습니다" : "모두 지나갔습니다");
process.exit(bad ? 1 : 0);
