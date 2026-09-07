// ─── 주소록 ────────────────────────────────────────────────
//
//  ※ 이 화면은 자료를 어디로도 보내지 않습니다.
//     내 컴퓨터의 엑셀을 브라우저가 직접 읽어 화면에만 그립니다.
//     GitHub 에도 Supabase 에도 한 글자도 올라가지 않습니다.
//     새로고침하면 사라지고, 다시 열려면 파일을 다시 고르면 됩니다.
//
//  읽는 것
//    00.주소록/개인명함첩_*.xlsx              리멤버 명함첩  (약 2,570명)
//    00.주소록/동경대 총동문회 주소록_*.xlsx   동문 명부     (약 1,310명)
//
//  두 파일의 「부서」는 뜻이 다릅니다 —
//    명함첩의 부서 = 다니는 회사의 팀,  동문 명부의 Department = 동경대 학부.
//    그래서 절대 한 칸에 합치지 않습니다.
import { currentUser, myProfile } from "../../auth/auth.js";
import { IMG_EXT, photoKey, nameFromFile, packText, readPack, packFileName, dataUrlType, sortPicked,
         orgKey, personKey, splitFileName, findKey, isSharedKey, readExtras, candidateKeys, faceFileStem } from "./addr-pack.js?v=202609080900";

/** 주인 이메일 — 이 사람만 주소록을 봅니다 */
export const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];

const XLSX_LIB = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm";
const PAGE = 200;                     // 한 번에 그리는 줄 수 (3,900명을 통째로 그리면 느립니다)
const NL = String.fromCharCode(10);

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));


/* ── 동경대 전공 코드 → 한글 이름 ──
   코드는 명부의 4번째 칸(머리글이 비어 있는 영문 코드)에서 옵니다.
   16가지뿐이고 가장 적은 것도 12명이라 갈래로 쓰기 좋습니다. */
export const MAJORS = {
  AR:   "건축",
  CUE:  "도시·사회기반",
  EM:   "기계·전기",
  CM:   "화학·생명",
  EE:   "조선·해양",
  IN:   "정보",
  SC:   "이학",
  AG:   "농학·수의",
  MM:   "의학·약학",
  L:    "법학·정치",
  EC:   "경제",
  HS:   "인문사회",
  T:    "총합문화",
  LAB:  "연구소",
  ETC:  "기타",
  Z_N:  "미분류",
};


/* ── 명함을 갈래로 나누기 ──
   명함첩에는 「그룹」 칸이 있지만 12%만 채워져 있어 쓸 수 없습니다.
   그래서 회사 이름과 직함을 보고 갈라냅니다.
   (실제 2,569장으로 재보니 공무원 538 · 교수 382 · 공공기관 529 · 기타 1,047) */
const RE_PROF_TITLE = /(교수|총장|학장|명예교수|초빙|겸임|석좌)/;
const RE_PROF_ORG   = /(대학교|대학원|\b대학\b|University|Univ)/i;
const RE_GOV        = new RegExp(
  "(광역시|특별시|특별자치|[가-힣]{1,4}(시청|도청|군청|구청)|시\\s*청|도\\s*청|의회|" +
  "행정안전부|국토교통부|기획재정부|[가-힣]{2,4}부$|청$|처$|위원회|" +
  "[가-힣]{1,4}시$|[가-힣]{1,4}군$|[가-힣]{1,4}구$|[가-힣]{1,4}도$)");
const RE_PUBLIC     = new RegExp(
  "(연구원|연구소|공사|공단|진흥원|재단|공제회|협회|개발원|정보원|평가원|" +
  "관리원|사업단|본부|출연|LH|SH|GH|코레일|철도공사)");

/** 대학 소속이면 직함이 무엇이든 「교수」 갈래로 봅니다 —
 *  찾을 때 학교 사람은 한자리에 모여 있는 편이 편하기 때문입니다. */
export function kindOf(company, title) {
  const c = String(company || ""), t = String(title || "");
  if (RE_PROF_TITLE.test(t) || RE_PROF_ORG.test(c)) return "prof";
  if (RE_GOV.test(c))    return "gov";
  if (RE_PUBLIC.test(c)) return "public";
  return "etc";
}

/** 화면 위쪽 갈래 단추 */
export const GROUPS = [
  ["all",    "전체",         "#4f9d92"],
  ["gov",    "명함_공무원",   "#2a5fa8"],
  ["prof",   "명함_교수",     "#8a6bb0"],
  ["public", "명함_공공기관", "#b3543b"],
  ["etc",    "명함_기타",     "#7d7768"],
  ["alum",   "동문",         "#c98a3f"],
];
export const GROUP_NAME  = Object.fromEntries(GROUPS.map(([k, v]) => [k, v]));
export const GROUP_COLOR = Object.fromEntries(GROUPS.map(([k, , c]) => [k, c]));


/* ── 값 다듬기 ─────────────────────────────────────────────── */
const txt   = (v) => (v == null ? "" : String(v).trim());
/** 전화번호에서 숫자만 남기고, 국제표기 82 를 0 으로 되돌립니다 */
export function tel(v) {
  let d = txt(v).replace(/[^0-9]/g, "");
  if (d.startsWith("82")) d = "0" + d.slice(2);
  if (d.length < 8) return "";                    // 4~5자리 쓰레기값을 버립니다
  if (d.startsWith("02")) {                       // 서울은 지역번호가 두 자리입니다
    if (d.length === 9)  return "02-" + d.slice(2, 5) + "-" + d.slice(5);
    if (d.length === 10) return "02-" + d.slice(2, 6) + "-" + d.slice(6);
  }
  if (d.length === 11) return d.slice(0, 3) + "-" + d.slice(3, 7) + "-" + d.slice(7);
  if (d.length === 10) return d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6);
  return d;
}
/** 동문 명부는 동명이인을 이름 끝 숫자로 갈라 두었습니다 — 보여줄 땐 뗍니다 */
const cleanName = (v) => txt(v).replace(/\s*\d+$/, "");


/* ── 엑셀 한 장을 우리 꼴로 ───────────────────────────────── */
export function fromRemember(rows) {
  return rows.map((r) => {
    const company = txt(r["회사"]);
    const title   = txt(r["직함"]);
    return {
      src: "card",
      kind: kindOf(company, title),
      name: txt(r["이름"]),
      company, title,
      orgDept: txt(r["부서"]),               // 회사의 팀 — 학부가 아닙니다
      email: txt(r["전자 메일 주소"]).toLowerCase(),
      mobile: tel(r["휴대폰"]),
      phone: tel(r["근무처 전화"]),
      addr: txt(r["근무지 주소 번지"]),
      major: "", majorName: "", univDept: "", degree: "", degreeYear: "",
      city: "", tag: txt(r["그룹"]),
      at: txt(r["명함 등록일"]),
    };
  }).filter((x) => x.name || x.company);
}

export function fromUtokyo(rows, headers) {
  // 4번째 칸은 머리글이 비어 있습니다 — 자리로 집어냅니다
  const codeKey = headers[3];
  return rows.map((r) => {
    const code = txt(r[codeKey]).toUpperCase();
    const company = txt(r["Company"]);
    return {
      src: "alum",
      kind: "alum",
      name: cleanName(r["Name_Korean"]),
      nameKanji: txt(r["Name_Kanji"]),
      company,
      title: txt(r["Job.Title"]),
      orgDept: "",
      email: (txt(r["E.mail.Address_1"]) || txt(r["E.mail.Address_2"])).toLowerCase(),
      mobile: tel(r["F"]),
      phone: tel(r["Business.Phone"]),
      addr: "",
      major: code,
      majorName: MAJORS[code] || code,
      univDept: txt(r["Department"]),          // 동경대 학부 — 회사 부서가 아닙니다
      degree: txt(r["Degree"]),
      degreeYear: (txt(r["Degree_year"]).match(/(19|20)\d{2}/) || [""])[0],
      lab: txt(r["LAB"]),
      city: txt(r["Home.City"]),
      tag: "",
      at: "",
    };
  }).filter((x) => x.name);
}


/* ── 같은 사람이 두 번 들어온 것을 하나로 ──
   리멤버는 내보낼 때마다 새 파일을 만들고, 한 파일 안에도 같은 사람이
   두 번 들어 있는 일이 있습니다. 사람을 가르는 열쇠는
   「어디서 왔나 + 이름 + 회사」 입니다.
   같은 사람이면 **새 것**을 남깁니다 — 명함 등록일이 늦은 쪽,
   그것도 같으면 채워진 칸이 많은 쪽입니다. */
const filled = (r) => Object.keys(r || {})
  .filter((k) => k !== "src" && k !== "kind")
  .reduce((n, k) => n + (String(r[k] == null ? "" : r[k]).trim() ? 1 : 0), 0);

export function dedupePeople(rows) {
  const best = new Map();
  const order = [];
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    if (!r) return;
    const key = [r.src || "", String(r.name || "").replace(/\s+/g, ""),
                 String(r.company || "").replace(/\s+/g, "")].join("|").toLowerCase();
    const cur = best.get(key);
    if (!cur) { best.set(key, r); order.push(key); return; }
    const at = (x) => String((x && x.at) || "");
    if (at(r) > at(cur) || (at(r) === at(cur) && filled(r) > filled(cur))) best.set(key, r);
  });
  return order.map((k) => best.get(k));
}


/* ── 내 컴퓨터 파일 기억해 두기 (IndexedDB) ──
   고른 폴더를 다음에 와도 기억합니다. 자료가 아니라 「어느 폴더였는지」만 담습니다. */
const DB = "skyish-addr", STORE = "handle", KEY = "folder";
const CACHE_STORE = "cache";           // 폰처럼 폴더를 못 여는 곳을 위한 자료 보관 칸
const PHOTO_STORE = "photos";          // 붙여넣기로 넣어 두신 얼굴 사진
/* 나중에 명함을 받아 손수 채워 넣으신 것.
   엑셀은 리멤버가 주는 대로라 고칠 수 없으니, 고친 것만 따로 담아 두었다가
   엑셀 위에 덧씌웁니다. 엑셀을 새로 읽어도 덧쓴 것은 그대로 남습니다.
   이것도 이 브라우저 안에만 있습니다 — 어디로도 올라가지 않습니다. */
const EXTRA_STORE = "extra";
const openDb = () => new Promise((ok, no) => {
  const r = indexedDB.open(DB, 4);
  r.onupgradeneeded = () => {
    const d = r.result;
    if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
    if (!d.objectStoreNames.contains(CACHE_STORE)) d.createObjectStore(CACHE_STORE);
    if (!d.objectStoreNames.contains(PHOTO_STORE)) d.createObjectStore(PHOTO_STORE);
    if (!d.objectStoreNames.contains(EXTRA_STORE)) d.createObjectStore(EXTRA_STORE);
  };
  r.onsuccess = () => ok(r.result);
  r.onerror = () => no(r.error);
});

/* 읽은 주소록을 이 브라우저 안에 담아 둡니다 — 어디로도 나가지 않습니다.
   폰은 컴퓨터 폴더를 못 열어서, 한 번 읽힌 것을 여기 두고 다음부터 폅니다. */
async function putCache(rows) {
  try {
    const db = await openDb();
    await new Promise((ok, no) => {
      const t = db.transaction(CACHE_STORE, "readwrite");
      t.objectStore(CACHE_STORE).put({ rows, at: Date.now() }, "rows");
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
    db.close();
  } catch (e) { /* 못 담아도 이번 화면은 그대로 씁니다 */ }
}
async function getCache() {
  try {
    const db = await openDb();
    const v = await new Promise((ok, no) => {
      const r = db.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get("rows");
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    db.close();
    return v || null;
  } catch (e) { return null; }
}
async function putHandle(h) {
  try {
    const db = await openDb();
    await new Promise((ok, no) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(h, KEY);
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
    db.close();
  } catch (e) { /* 기억 못 해도 쓰는 데 지장 없습니다 */ }
}
async function getHandle() {
  try {
    const db = await openDb();
    const v = await new Promise((ok, no) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    db.close();
    return v || null;
  } catch (e) { return null; }
}


/* ── 폴더에서 엑셀 두 개 찾아 읽기 ───────────────────────── */
async function readWorkbook(file, XLSX) {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return wb;
}

function sheetRows(XLSX, wb, wanted) {
  const name = wb.SheetNames.find((n) => wanted.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
  return { rows, headers: headers.map((h) => txt(h)) };
}

export async function loadFromFiles(files, say) {
  const XLSX = await import(/* @vite-ignore */ XLSX_LIB);
  let out = [];
  for (const f of files) {
    const n = f.name;
    if (!/\.xlsx?$/i.test(n) || /^~\$/.test(n)) continue;
    if (say) say(n + " 읽는 중…");
    const wb = await readWorkbook(f, XLSX);

    /* 어느 엑셀인지는 파일 이름이 아니라 「속」을 보고 가립니다.
       폰으로 내려받다 이름이 바뀌어도 (「문서 (1).xlsx」 처럼) 읽힙니다. */
    const isCard = /명함/.test(n) || wb.SheetNames.some((sn) => /remember/i.test(sn));
    const alumSheet = wb.SheetNames.find((sn) => /전체주소록/.test(sn) && !/사본/.test(sn));
    if (isCard) {
      const { rows } = sheetRows(XLSX, wb, /remember/i);
      out = out.concat(fromRemember(rows));
    } else if (alumSheet) {
      const ws = wb.Sheets[alumSheet];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const headers = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || []).map(txt);
      out = out.concat(fromUtokyo(rows, headers));
    } else if (say) {
      say(n + " — 명함첩(remember)도 동문 명부(전체주소록)도 아닌 것 같아 건너뜁니다.");
    }
  }
  return out;
}


/* ── 동문 이름만 꺼내 주기 ──
   「사람들」 관계망이 씁니다. 내가 만난 사람 가운데 누가 동경대 동문인지
   이름을 맞춰 보려는 것입니다.
   · 지난번에 골라 둔 폴더의 권한이 살아 있을 때만 읽습니다 (묻는 창을 띄우지 않습니다)
   · 이름 Set 만 돌려줍니다 — 명부의 다른 정보는 그 화면으로 가져가지 않습니다
   · 어디로도 올라가지 않습니다. 이 브라우저 안에서 끝납니다. */
export async function alumniNames() {
  try {
    if (typeof window.showDirectoryPicker !== "function") return new Set();
    const h = await getHandle();
    if (!h) return new Set();
    const st = await h.queryPermission({ mode: "read" }).catch(() => "prompt");
    if (st !== "granted") return new Set();

    const files = [];
    for await (const e of h.values()) {
      if (e.kind !== "file") continue;
      const n = e.name;
      if (!/\.xlsx?$/i.test(n) || /^~\$/.test(n)) continue;
      if (!/주소록|동문|동경대/.test(n) || /명함/.test(n)) continue;   // 동문 명부만
      files.push(await e.getFile());
    }
    if (!files.length) return new Set();

    const out = new Set();
    (await loadFromFiles(files)).forEach((r) => {
      if (r.src === "alum" && r.name) out.add(r.name);
    });
    return out;
  } catch (e) { return new Set(); }
}

/* ── 명함첩만 뽑아 오기 ──
   달력에서 「그날 만난 사람」 의 명함을 보여 주려고 씁니다.
   허락해 두신 00.주소록 폴더에서 개인명함첩_*.xlsx 만 읽습니다.
   폴더를 아직 안 고르셨거나 허락이 풀렸으면 조용히 빈 목록을 돌려줍니다
   — 달력은 그대로 잘 돌아가야 하니까요.

   2,500장을 화면 열 때마다 다시 읽으면 느리므로 한 번 읽은 것은 담아 둡니다.
   담아 두는 곳은 이 탭의 기억(변수)뿐입니다 — 새로고침하면 사라지고,
   어디로도 나가지 않습니다. */
let cardCache = null;

export async function cards(force) {
  if (cardCache && !force) return cardCache;
  try {
    if (typeof window.showDirectoryPicker !== "function") return (cardCache = []);
    const h = await getHandle();
    if (!h) return (cardCache = []);
    const st = await h.queryPermission({ mode: "read" }).catch(() => "prompt");
    if (st !== "granted") return (cardCache = []);

    const files = [];
    for await (const e of h.values()) {
      if (e.kind !== "file") continue;
      const n = e.name;
      if (!/\.xlsx?$/i.test(n) || /^~\$/.test(n)) continue;
      if (!/명함/.test(n)) continue;                    // 명함첩만
      files.push(await e.getFile());
    }
    if (!files.length) return (cardCache = []);

    /* 파일이 여럿이면 가장 새것 하나만 — 리멤버는 내보낼 때마다 새 파일을
       만들어서, 옛 파일이 남아 있으면 한 사람이 두 번 잡힙니다. */
    files.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    cardCache = (await loadFromFiles([files[0]])).filter((r) => r.src === "card");
    return cardCache;
  } catch (e) { return (cardCache = []); }
}

/* ── 명함 사진 ──
   00.주소록/명함사진/ 폴더에 넣어 두신 그림을 이름으로 찾아 씁니다.
     명함사진/이석준.jpg          → 이석준
     명함사진/서민호_국토연구원.png → 서민호   (밑줄 뒤는 무시합니다)
   리멤버 앱의 명함 스캔이나 행사 사진처럼 **이미 갖고 계신 그림**을 쓰는 자리입니다.
   인터넷에서 얼굴을 긁어 오지 않습니다 — 남의 얼굴을 본인 모르게 모으는 일이라
   하지 않습니다.

   그림은 브라우저 안에서만 풀립니다 (blob:). 어디로도 올라가지 않습니다. */
const FACE_KEY = "face";              // 얼굴 사진 폴더 손잡이 (IndexedDB)
/* 그림이 들어 있을 만한 폴더 이름 —
   홈피 폴더의 9.FACE 가 기본이고, 옛 이름도 함께 봅니다. */
const PHOTO_DIRS = ["9.FACE", "face", "FACE", "명함사진"];
let photoMap = null;                  // 열쇠 → 파일 손잡이
const photoUrls = new Map();          // 열쇠 → blob 주소 (한 번만 만듭니다)


/** 얼굴 사진 폴더를 골라 둡니다 — 홈피 폴더의 face/ 를 고르시면 됩니다 */
export async function pickFaceFolder() {
  if (typeof window.showDirectoryPicker !== "function") return false;
  /* 읽고 쓰기로 고릅니다 — 붙여넣은 사진을 「이름.jpg」 로 이 폴더에
     되돌려 저장하기 위해서입니다. 쓰기를 허락 안 하셔도 읽기는 됩니다. */
  const dir = await window.showDirectoryPicker({ id: "skyish-face", mode: "readwrite" });
  try {
    const db = await openDb();
    await new Promise((ok, no) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(dir, FACE_KEY);
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
    db.close();
  } catch (e) {}
  photoMap = null;                    // 다시 읽습니다
  photoUrls.clear();
  return true;
}

async function faceHandle() {
  try {
    const db = await openDb();
    const v = await new Promise((ok, no) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(FACE_KEY);
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    db.close();
    return v || null;
  } catch (e) { return null; }
}

/** 이 폴더 안에 9.FACE 같은 그림 폴더가 있으면 그것을, 없으면 자기 자신을 */
async function intoPhotoDir(dir) {
  if (!dir) return null;
  try {
    for await (const e of dir.values()) {
      if (e.kind === "directory" && PHOTO_DIRS.indexOf(e.name) >= 0) return e;
    }
  } catch (e) {}
  return dir;
}

/** 그림이 든 폴더를 찾습니다 —
    ① 따로 골라 두신 폴더 (9.FACE 를 곧바로 고르셨어도, 홈피 폴더를
       고르셨어도 됩니다 — 안에 9.FACE 가 있으면 그리로 들어갑니다)
    ② 없으면 00.주소록 안의 명함사진/ */
async function photoDir() {
  const f = await faceHandle();
  if (f) {
    const st = await f.queryPermission({ mode: "read" }).catch(() => "prompt");
    if (st === "granted") return await intoPhotoDir(f);
  }
  const h = await getHandle();
  if (!h) return null;
  const st = await h.queryPermission({ mode: "read" }).catch(() => "prompt");
  if (st !== "granted") return null;
  for await (const e of h.values()) {
    if (e.kind === "directory" && PHOTO_DIRS.indexOf(e.name) >= 0) return e;
  }
  return null;
}

/* ── 표 정렬 ──────────────────────────────────────────────
   칸 이름을 누르면 그 칸으로 줄을 세웁니다. 한 번 더 누르면 거꾸로.
   한글은 사전 차례(localeCompare "ko"), 빈 칸은 늘 맨 뒤로 보냅니다
   — 빈 칸이 위에 몰리면 아무것도 안 보이는 것처럼 느껴집니다. */
export const SORT_KEYS = {
  name:    (r) => r.name,
  company: (r) => r.company,
  title:   (r) => r.title,
  major:   (r) => r.majorName || r.univDept,
  tel:     (r) => r.mobile || r.phone,
  src:     (r) => (r.src === "alum" ? "동문" : (GROUP_NAME[r.kind] || "")),
  photo:   null,          // 사진은 따로 — 있는 사람이 먼저
};

/**
 * @param rows  줄 목록
 * @param key   SORT_KEYS 의 이름 ("" 이면 원래 차례 그대로)
 * @param dir   1 오름차순 · -1 내림차순
 * @param has   (name) => boolean — 사진이 있는지 (photo 로 세울 때만 씁니다)
 */
export function sortRows(rows, key, dir, has) {
  const L = Array.isArray(rows) ? rows.slice() : [];
  if (!key || (key !== "photo" && !SORT_KEYS[key])) return L;
  const d = dir < 0 ? -1 : 1;
  if (key === "photo") {
    const yes = (r) => (has && has(r && r.name, r)) ? 1 : 0;
    return L.map((r, i) => [r, i]).sort((A, B) => {
      const g = yes(B[0]) - yes(A[0]);          // 있는 사람이 먼저
      return (g ? g * d : 0) || A[1] - B[1];    // 같으면 원래 차례
    }).map(([r]) => r);
  }
  const get = SORT_KEYS[key];
  const v = (r) => String(get(r) == null ? "" : get(r)).trim();
  return L.map((r, i) => [r, i]).sort((A, B) => {
    const a = v(A[0]), b = v(B[0]);
    if (!a && !b) return A[1] - B[1];
    if (!a) return 1;                            // 빈 칸은 늘 맨 뒤
    if (!b) return -1;
    const c = a.localeCompare(b, "ko", { numeric: true });
    return (c ? c * d : 0) || A[1] - B[1];
  }).map(([r]) => r);
}

/** 그림 종류 → 확장자 */
export function extOf(type) {
  const t = String(type || "").toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg") return ".jpg";
  if (t === "image/webp") return ".webp";
  if (t === "image/gif") return ".gif";
  if (t === "image/avif") return ".avif";
  return ".png";
}

/** 사람 이름 → 파일 이름. 파일에 못 쓰는 글자만 걷어냅니다. */
export function safeFileName(name) {
  return String(name || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 60);
}

/** 폴더 하나를 훑어 「이름 → 파일」 표를 만듭니다.
 *  · 파일 이름이 곧 사람 이름입니다 — 「이석준.jpg」
 *  · 밑줄·괄호 뒤는 메모로 봅니다 — 「서민호_국토연구원.png」 → 서민호
 *  · 하위 폴더도 한 겹 봅니다 (기관별로 나눠 두셔도 됩니다)
 *  · 같은 이름이 여럿이면 먼저 나온 것을 씁니다
 *  손잡이(FileSystemDirectoryHandle)든, values() 를 가진 무엇이든 됩니다 —
 *  그래서 시험할 수 있습니다 (tools/test/addr.mjs).
 */
export async function collectPhotos(dir) {
  const m = new Map();
  if (!dir) return m;
  const eat = async (d) => {
    for await (const e of d.values()) {
      if (e.kind !== "file" || !IMG_EXT.test(e.name)) continue;
      /* 파일 이름이 「이름_소속.jpg」 이면 소속까지 열쇠로 씁니다 —
         이름만 보면 동명이인이 같은 얼굴을 답니다.
         담긴 폴더(d)도 함께 적어 둡니다 — 지우려면 그 폴더가 있어야 합니다. */
      const who = splitFileName(e.name);
      const k = personKey(who.name, who.org);
      if (k && !m.has(k)) m.set(k, { fh: e, dir: d, name: e.name });
    }
  };
  try {
    await eat(dir);
    for await (const e of dir.values()) {
      if (e.kind === "directory") { try { await eat(e); } catch (x) {} }
    }
  } catch (e) { /* 못 읽는 폴더가 섞여도 나머지는 씁니다 */ }
  return m;
}

async function loadPhotoMap() {
  if (photoMap) return photoMap;
  photoMap = new Map();
  try {
    photoMap = await collectPhotos(await photoDir());
  } catch (e) { /* 폴더가 없어도 그냥 갑니다 */ }
  return photoMap;
}

/* ── 붙여넣은 사진 ──
   Ctrl+V 로 넣으신 그림은 이 브라우저의 IndexedDB 에 담깁니다.
   폴더 권한이 필요 없고, 다음에 와도 그대로 있습니다.
   어디로도 올라가지 않습니다 — skyish.kr 에도, GitHub 에도. */
let storedKeyCache = null;               // 담아 둔 열쇠 — 바뀔 때만 다시 읽습니다

/* 주소록에 이름이 둘 이상 있는 분들.
   이런 분들은 소속까지 맞아야 사진이 붙습니다. 이름이 하나뿐이면 느슨하게 봅니다
   (9.FACE 에는 「김고은_부연구위원.jpg」 처럼 밑줄 뒤가 직함인 파일이 많습니다). */
let twinNames = new Set();
export function setTwins(rows) {
  const c = new Map();
  (rows || []).forEach((r) => {
    const n = photoKey(r && r.name);
    if (n) c.set(n, (c.get(n) || 0) + 1);
  });
  twinNames = new Set([...c].filter(([, v]) => v > 1).map(([k]) => k));
  return twinNames;
}
export const isTwin = (name) => twinNames.has(photoKey(name));

export async function savePhoto(name, blob, org) {
  const k = personKey(name, org);
  if (!k || !blob) return false;
  try {
    const db = await openDb();
    await new Promise((ok, no) => {
      const t = db.transaction(PHOTO_STORE, "readwrite");
      t.objectStore(PHOTO_STORE).put(blob, k);
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
    db.close();
    storedKeyCache = null;
    const old = photoUrls.get(k);
    if (old) URL.revokeObjectURL(old);
    photoUrls.delete(k);                 // 다음에 물으면 새로 만듭니다
    return true;
  } catch (e) { return false; }
}

/** 붙여넣은 사진을 9.FACE 폴더에 「이름.jpg」 로 되돌려 저장합니다.
 *  폴더를 안 고르셨거나 쓰기를 안 허락하셨으면 조용히 넘어갑니다
 *  (브라우저 안 사본은 이미 저장돼 있어 화면에는 그대로 보입니다).
 *  @returns 저장한 파일 이름, 못 했으면 빈 글자
 */
export async function saveToFaceFolder(name, blob, org) {
  try {
    const dir = await photoDir();
    if (!dir || typeof dir.getFileHandle !== "function") return "";
    let st = await dir.queryPermission({ mode: "readwrite" }).catch(() => "prompt");
    if (st !== "granted") {
      /* 붙여넣기는 사람이 누른 자리라 여기서 물어볼 수 있습니다 */
      st = await dir.requestPermission({ mode: "readwrite" }).catch(() => "denied");
    }
    if (st !== "granted") return "";
    /* 「이름_소속.jpg」 — 소속을 붙여야 동명이인이 서로 덮어쓰지 않습니다.
       이름 짓는 규칙은 addr-pack.js 에 한 벌만 두었습니다 (되읽기와 짝이 맞아야 합니다). */
    const fname = faceFileStem(name, org, safeFileName) + extOf(blob && blob.type);
    const fh = await dir.getFileHandle(fname, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    photoMap = null;                 // 폴더를 다시 읽습니다
    return fname;
  } catch (e) { return ""; }
}

/** 9.FACE 폴더에 있는 그림 파일을 지웁니다.
 *  **되돌릴 수 없습니다** — 부르는 쪽에서 반드시 사람에게 물은 뒤에 부르십시오.
 *  전에는 브라우저 안 사본만 지워, 「사진 지우기」 를 눌러도 폴더에서 다시 읽혀
 *  얼굴이 그대로 돌아왔습니다.
 *  @returns 지운 파일 이름, 못 지웠으면 빈 글자
 */
export async function deleteFolderEntry(it) {
  if (!it || !it.dir || typeof it.dir.removeEntry !== "function" || !it.name) return "";
  try {
    /* 쓰기를 허락받아야 지울 수 있습니다. 사람이 누른 자리에서 부르므로
       여기서 물어봐도 됩니다. */
    let st = "granted";
    if (typeof it.dir.queryPermission === "function") {
      st = await it.dir.queryPermission({ mode: "readwrite" }).catch(() => "prompt");
    }
    if (st !== "granted" && typeof it.dir.requestPermission === "function") {
      st = await it.dir.requestPermission({ mode: "readwrite" }).catch(() => "denied");
    }
    if (st !== "granted") return "";
    await it.dir.removeEntry(it.name);
    return it.name;
  } catch (e) { return ""; }
}

export async function removeFolderPhoto(k) {
  if (!k) return "";
  try {
    const gone = await deleteFolderEntry((await loadPhotoMap()).get(k));
    if (!gone) return "";
    photoMap = null;                       // 폴더를 다시 읽습니다
    const old = photoUrls.get(k);
    if (old) URL.revokeObjectURL(old);
    photoUrls.delete(k);
    return gone;
  } catch (e) { return ""; }
}

/** 붙여넣은 사진을 지웁니다 (폴더에 있는 그림은 removeFolderPhoto 로) */
export async function dropPhoto(name, org) {
  const k = personKey(name, org);
  if (!k) return;
  try {
    const db = await openDb();
    await new Promise((ok, no) => {
      const t = db.transaction(PHOTO_STORE, "readwrite");
      t.objectStore(PHOTO_STORE).delete(k);
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
    db.close();
    storedKeyCache = null;
  } catch (e) {}
  const old = photoUrls.get(k);
  if (old) URL.revokeObjectURL(old);
  photoUrls.delete(k);
}

async function storedPhoto(k) {
  try {
    const db = await openDb();
    const v = await new Promise((ok, no) => {
      const r = db.transaction(PHOTO_STORE, "readonly").objectStore(PHOTO_STORE).get(k);
      r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
    });
    db.close();
    return v || null;
  } catch (e) { return null; }
}

/** 이 사람의 사진 주소 — 없으면 빈 글자.
    ① 붙여넣어 두신 것  ② 없으면 폴더에 있는 그림 */
export async function photo(name, org) {
  const k = findKey(await photoNames(), name, org, isTwin(name));
  if (!k) return "";
  if (photoUrls.has(k)) return photoUrls.get(k);
  try {
    const b = await storedPhoto(k);
    if (b) {
      const url = URL.createObjectURL(b);
      photoUrls.set(k, url);
      return url;
    }
    const m = await loadPhotoMap();
    const it = m.get(k);
    if (!it) { photoUrls.set(k, ""); return ""; }
    const url = URL.createObjectURL(await it.fh.getFile());
    photoUrls.set(k, url);
    return url;
  } catch (e) { photoUrls.set(k, ""); return ""; }
}

/** 붙여넣어 담아 둔 사진들의 이름 열쇠 */
async function storedNames() {
  if (storedKeyCache) return storedKeyCache;
  try {
    const db = await openDb();
    const v = await new Promise((ok, no) => {
      const r = db.transaction(PHOTO_STORE, "readonly").objectStore(PHOTO_STORE).getAllKeys();
      r.onsuccess = () => ok(r.result || []); r.onerror = () => no(r.error);
    });
    db.close();
    storedKeyCache = v.map(String);
    return storedKeyCache;
  } catch (e) { return []; }
}

/** 사진이 있는 사람의 이름 열쇠 모두 —
 *  ① 9.FACE 폴더에 있는 것  ② 붙여넣어 담아 둔 것
 *  화면에 그려진 줄만 보고는 3,859명을 줄 세울 수 없어서,
 *  미리 한 번에 모아 둡니다. */
export async function photoNames() {
  const out = new Set();
  try { (await loadPhotoMap()).forEach((_, k) => out.add(k)); } catch (e) {}
  try { (await storedNames()).forEach((k) => out.add(String(k))); } catch (e) {}
  return out;
}

/** 담아 둔 사진을 모두 꺼냅니다 — [{key, blob}] */
async function allStoredPhotos() {
  const keys = await storedNames();
  const out = [];
  for (const k of keys) {
    const b = await storedPhoto(String(k));
    if (b) out.push({ key: String(k), blob: b });
  }
  return out;
}

const asDataUrl = (blob) => new Promise((ok) => {
  try {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result || ""));
    fr.onerror = () => ok("");
    fr.readAsDataURL(blob);
  } catch (e) { ok(""); }
});

/** 얼굴 사진을 한 파일로 묶습니다 — 폰으로 옮기실 때 씁니다.
 *  폴더에 있는 것과 이 브라우저에 담아 둔 것을 모두 담습니다.
 *  파일은 내 컴퓨터에 내려받아질 뿐, 어디로도 올라가지 않습니다.
 *  @returns {blob, n} — 담은 장수
 */
export async function buildPhotoPack(onStep) {
  const items = [];
  const seen = new Set();
  const add = async (key, blob) => {
    const k = photoKey(key);
    if (!k || seen.has(k) || !blob) return;
    const data = await asDataUrl(blob);
    if (!/^data:image\//.test(data)) return;
    seen.add(k);
    items.push({ key: k, data });
    if (typeof onStep === "function") onStep(items.length);
  };
  /* 담아 둔 것을 먼저 — 붙여넣어 다듬으신 쪽이 더 새것입니다 */
  for (const p of await allStoredPhotos()) await add(p.key, p.blob);
  try {
    const m = await loadPhotoMap();
    for (const [k, it] of m) {
      try { await add(k, await it.fh.getFile()); } catch (e) {}
    }
  } catch (e) {}
  /* 나중에 채워 넣으신 내용도 함께 담습니다 — 폰에서도 그대로 보이게 */
  const extras = await allExtras();
  const blob = new Blob([packText(items, extras)], { type: "application/json" });
  return { blob, n: items.length, nExtra: extras.size };
}

/** 고르신 파일들을 이 브라우저에 담습니다 —
 *  꾸러미(.json) 든 그림이든 받습니다.
 *
 *  @param known 주소록에 있는 사람 열쇠들. 넘기면 **아는 이름만** 담습니다 —
 *               폰 사진첩의 「IMG_4821.JPG」 를 그대로 받으면 「img|4821」 같은
 *               열쇠가 생겨, 담았다고 알리고도 얼굴은 한 장도 안 붙습니다.
 *  @returns {n, people, skipped} — 담은 장수 · 얼굴이 붙은 사람 수 · 못 담은 파일
 */
export async function importPhotos(files, onStep, known) {
  const list = [...(files || [])];
  const skipped = [];
  const hit = new Set();
  let n = 0;
  const step = () => { if (typeof onStep === "function") onStep(n); };
  const tooBig = (f) => (f.size || 0) > 12 * 1024 * 1024;

  for (const f of list) {
    const nm = f.webkitRelativePath || f.name || "";
    try {
      /* ── 꾸러미 ── */
      if (/\.json$/i.test(nm) || /json/i.test(f.type || "")) {
        const txt = await f.text();
        const got = readPack(txt);
        const ex = readExtras(txt);
        if (!got.length && !ex.length) { skipped.push(nm + " — 꾸러미가 아닙니다"); continue; }
        /* 덧쓴 내용을 **먼저** 담습니다 — 사진에서 터져도 이것은 남게 */
        for (const e of ex) {
          try { await saveExtra(e.key, "", e.data); } catch (err) { skipped.push(nm + " / " + e.key); }
        }
        /* 사진은 한 장씩 감쌉니다 — 한 장이 터져도 나머지 수백 장이 들어가게 */
        for (const g of got) {
          try {
            const b = await (await fetch(g.data)).blob();
            if (await savePhoto(g.key, b)) { n++; hit.add(g.key); step(); }
            else skipped.push(nm + " / " + g.key + " — 담지 못했습니다 (저장 공간?)");
          } catch (err) { skipped.push(nm + " / " + g.key); }
        }
        continue;
      }

      /* ── 그림 한 장 ── */
      if (!IMG_EXT.test(nm) && !/^image\//.test(f.type || "")) {
        skipped.push(nm + " — 그림이 아닙니다"); continue;
      }
      if (/heic|heif/i.test(f.type || "") || /\.hei[cf]$/i.test(nm)) {
        /* 아이폰 기본 꼴입니다. 이 폰에서는 보이지만 다른 기기에서는 빈칸이 됩니다 */
        skipped.push(nm + " — HEIC 는 다른 기기에서 안 보입니다 (JPG 로 바꿔 주세요)"); continue;
      }
      if (tooBig(f)) { skipped.push(nm + " — 12MB 를 넘습니다"); continue; }

      /* 파일 이름이 곧 사람 이름입니다 — 「이름_소속.jpg」 규칙 그대로 */
      const who = splitFileName(nm);
      if (!who.name) { skipped.push(nm + " — 이름을 못 읽었습니다"); continue; }
      /* 주소록에 없는 이름은 담지 않습니다.
         담아 봐야 아무에게도 안 붙고, 지울 길도 없이 저장소에 쌓입니다. */
      const key = known
        ? findKey(known, who.name, who.org, false) && personKey(who.name, who.org)
        : personKey(who.name, who.org);
      if (!key) { skipped.push(nm + " — 주소록에 없는 이름입니다"); continue; }
      if (await savePhoto(who.name, f, who.org)) { n++; hit.add(key); step(); }
      else skipped.push(nm + " — 담지 못했습니다");
    } catch (e) { skipped.push(nm + " — " + ((e && e.message) || "읽지 못했습니다")); }
  }
  return { n, people: hit.size, skipped };
}

/* ── 나중에 채워 넣은 내용 ──────────────────────────────
   「주소록은 나중에 명함받으면 상세내용을 더 추가할수있도록 해줘」 */

let extraCache = null;

/** 덧쓴 내용 모두 — Map(열쇠 → {…칸, memo, at}) */
export async function allExtras() {
  if (extraCache) return extraCache;
  const m = new Map();
  try {
    const db = await openDb();
    const [keys, vals] = await new Promise((ok, no) => {
      const st = db.transaction(EXTRA_STORE, "readonly").objectStore(EXTRA_STORE);
      const a = st.getAllKeys(), b = st.getAll();
      let ka = null, va = null;
      a.onsuccess = () => { ka = a.result || []; if (va) ok([ka, va]); };
      b.onsuccess = () => { va = b.result || []; if (ka) ok([ka, va]); };
      a.onerror = b.onerror = () => no(a.error || b.error);
    });
    db.close();
    keys.forEach((k, i) => m.set(String(k), vals[i] || {}));
  } catch (e) {}
  extraCache = m;
  return m;
}

/** 이 사람에게 덧쓴 내용 */
export async function getExtra(name, org) {
  return (await allExtras()).get(personKey(name, org)) || null;
}

/** 덧쓰기 — 다 비우면 덧쓴 것을 없앱니다 */
export async function saveExtra(name, org, data) {
  const k = personKey(name, org);
  if (!k) return false;
  const clean = {};
  Object.keys(data || {}).forEach((f) => {
    const v = String(data[f] == null ? "" : data[f]).trim();
    if (v) clean[f] = v;
  });
  try {
    const db = await openDb();
    await new Promise((ok, no) => {
      const t = db.transaction(EXTRA_STORE, "readwrite");
      const st = t.objectStore(EXTRA_STORE);
      if (Object.keys(clean).length) st.put({ ...clean, at: Date.now() }, k);
      else st.delete(k);
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
    db.close();
    extraCache = null;
    return true;
  } catch (e) { return false; }
}

/** 엑셀에서 읽은 줄 위에 덧쓴 것을 얹습니다 — 덧쓴 쪽이 이깁니다 */
export function applyExtras(rows, map) {
  if (!map || !map.size) return rows || [];
  return (rows || []).map((r) => {
    const e = map.get(personKey(r.name, r.company));
    if (!e) return r;
    const out = { ...r };
    Object.keys(e).forEach((f) => { if (f !== "at" && e[f]) out[f] = e[f]; });
    out.__extra = true;                        // 손댄 줄임을 표시해 둡니다
    return out;
  });
}

/** 이 사람에게 붙는 사진의 열쇠 — 없으면 빈 글자 */
export async function photoKeyOf(name, org) {
  return findKey(await photoNames(), name, org, isTwin(name));
}

/** 이름은 같은데 붙지 못한 사진들 — 「이 분 것인가요?」 를 물을 때 씁니다 */
export async function loosePhotoKeys(name) {
  return candidateKeys(await photoNames(), name);
}

/** 그 열쇠의 사진 주소 (누구의 것인지 따지지 않고) */
export async function photoByKey(k) {
  if (!k) return "";
  if (photoUrls.has(k)) return photoUrls.get(k);
  try {
    const b = await storedPhoto(k);
    if (b) { const u = URL.createObjectURL(b); photoUrls.set(k, u); return u; }
    const it = (await loadPhotoMap()).get(k);
    if (!it) return "";
    const u = URL.createObjectURL(await it.fh.getFile());
    photoUrls.set(k, u);
    return u;
  } catch (e) { return ""; }
}

/** 그 열쇠가 9.FACE 폴더에서 온 것인가 — 그러면 여기서는 못 지웁니다.
    @returns 폴더 안 파일 이름, 아니면 빈 글자 */
export async function fromFolder(k) {
  if (!k) return "";
  try {
    if (await storedPhoto(k)) return "";            // 브라우저 안 사본이 먼저입니다
    const it = (await loadPhotoMap()).get(k);
    return it ? (it.name || "그림 파일") : "";
  } catch (e) { return ""; }
}

/** 사진이 몇 장 준비돼 있는지 — 안내에 씁니다 */
export async function photoCount() {
  return (await loadPhotoMap()).size;
}

/** 표를 그린 뒤, 사진이 있는 분의 이름 칸에 얼굴을 얹습니다.
    없는 분은 그대로 둡니다 — 자리를 비워 두면 줄이 들쭉날쭉해집니다. */
async function fillFaces(tbody) {
  if (!tbody) return;
  const cells = [...tbody.querySelectorAll("td.aface[data-n]")];
  if (!cells.length) return;
  for (const td of cells) {
    const name = td.dataset.n;
    const org = td.dataset.o || "";        // 동명이인을 가르는 열쇠
    const u = await photo(name, org);
    /* 얼굴 — 있으면 이름 앞에 동그랗게 */
    const had = td.querySelector(".afaceimg");
    if (u && !had) {
      /* 이름 바로 오른쪽에 붙입니다 — 소속 줄(.asub) 은 아래에 그대로 옵니다 */
      const nameEl = td.querySelector("b");
      const html = '<img class="afaceimg" src="' + u + '" alt="" loading="lazy">';
      if (nameEl) nameEl.insertAdjacentHTML("afterend", html);
      else td.insertAdjacentHTML("afterbegin", html);
    } else if (!u && had) { had.remove(); }
    /* 맨 끝 칸에 O · X */
    const tr = td.parentElement;
    const mark = tr && tr.querySelector("td.ahas");
    if (mark) {
      mark.textContent = u ? "O" : "X";
      mark.className = "ahas " + (u ? "yes" : "no");
    }
    /* 되짚기(onFace)는 걷어 냈습니다.
       전에는 여기서 havePhoto 에 「새로 지은 열쇠」 를 넣었는데, 실제로 붙은 열쇠와
       달라 유령 열쇠가 생겼습니다 (얼굴이 깜빡이고, 사진 칸으로 줄 세우면
       paint() 가 끝없이 돌았습니다). havePhoto 는 photoNames() 하나만 채웁니다. */
  }
}


/* ══════════════════════════════════════════════════════════ */
export async function initAddr(mountId = "addrapp", sectionId = "addrsec") {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  const section = document.getElementById(sectionId);

  const user = await currentUser();
  const me = user ? await myProfile().catch(() => null) : null;
  const mail = ((user && user.email) || "").toLowerCase();
  const isAdmin = !!(me && me.is_admin) || OWNERS.indexOf(mail) >= 0;

  // 관리자가 아니면 이 자리는 아예 없는 것처럼 둡니다
  if (!isAdmin) { if (section) section.remove(); else mount.remove(); return false; }

  const FSA = typeof window.showDirectoryPicker === "function";

  mount.innerHTML =
    '<div class="abar">' +
      '<button type="button" class="nbtn nbtn--go" id="abOpen">📁 주소록 폴더 열기</button>' +
      /* 얼굴 사진은 따로 골라 둡니다 — 홈피 폴더의 face/ 를 고르시면 됩니다.
         한 번 고르면 기억합니다. 그림은 브라우저 안에서만 풀립니다. */
      (FSA ? '<button type="button" class="nbtn" id="abFace" ' +
        'title="홈피 폴더의 9.FACE 를 고르세요 — 파일 이름이 사람 이름인 그림을 얼굴로 씁니다">' +
        '🙂 얼굴 사진 폴더</button>' : "") +
      /* 얼굴 사진 가져오기 — 폰에는 컴퓨터 폴더가 없습니다.
         꾸러미(.json) 한 개든 그림 여러 장이든 받습니다.
         고른 파일은 이 브라우저 안에만 담깁니다. */
      /* accept 를 적지 않습니다 — image/* 와 .json 을 섞어 적으면 아이폰에서
         꾸러미(.json)가 아예 안 골라집니다. 갈래는 받아서 우리가 가립니다. */
      '<label class="nbtn afiles" id="abPhotoLbl" ' +
        'title="컴퓨터에서 내보낸 「사진 꾸러미」 하나, 또는 얼굴 그림 여러 장">' +
        '🙂 얼굴 사진 가져오기' +
        '<input type="file" id="abPhotos" multiple hidden>' +
      "</label>" +
      /* 컴퓨터에서 폰으로 옮길 때 — 가진 얼굴을 한 파일로 묶습니다.
         폰·사파리·파이어폭스에도 놓습니다 — 폴더를 못 여는 곳일수록
         브라우저 안에 담긴 사진을 꺼낼 길이 여기밖에 없습니다. */
      '<button type="button" class="nbtn" id="abPack" ' +
        'title="가진 얼굴 사진과 채워 넣은 내용을 한 파일로 내려받습니다">' +
        '⤓ 사진 꾸러미</button>' +
      '<button type="button" class="nbtn" id="abAgain" hidden></button>' +
      (FSA ? "" :
        '<label class="nbtn afiles">📄 엑셀 고르기' +
          '<input type="file" id="abFiles" accept=".xlsx,.xls" multiple hidden></label>') +
      '<span class="ahint" id="abHint">' +
        "고른 자료는 이 화면에만 그려집니다. 어디로도 올라가지 않습니다." +
      "</span>" +
      /* 얼굴 사진 옮기는 길 — 자료가 들어와도 지우지 않습니다.
         전에는 「아직 안 읽었습니다」 안내(abNot) 안에만 적어 두어,
         이미 주소록이 열려 있는 분(=정작 읽어야 할 분)은 볼 수가 없었습니다. */
      '<p class="ahint ahint--how" id="abHow">' +
        "얼굴 사진은 <b>이 브라우저 안에만</b> 있습니다. 다른 기기(폰)에서도 보시려면 " +
        "컴퓨터에서 <b>⤓ 사진 꾸러미</b> 로 한 파일을 내려받아 옮기신 뒤, " +
        "거기서 <b>🙂 얼굴 사진 가져오기</b> 로 그 파일을 고르세요." +
      "</p>" +
      /* 자료가 아직 없을 때 「사라진 게 아니라 아직 안 읽은 것」 임을 알려 줍니다 */
      '<p class="anot" id="abNot">명함첩과 동문 명부는 <b>내 컴퓨터에만</b> 있습니다.<br>' +
        "브라우저는 페이지를 열 때마다 폴더를 새로 읽어야 해서, " +
        "위 단추를 한 번 누르시면 <b>명함_공무원 · 교수 · 공공기관 · 기타</b> 갈래와 " +
        "찾는 칸이 그대로 돌아옵니다.</p>" +
    "</div>" +
    '<div id="abBody"></div>';

  const hint = document.getElementById("abHint");
  const body = document.getElementById("abBody");
  const say  = (t) => { hint.textContent = t; };

  let rows = [], cur = "all", major = "", shownCount = PAGE;
  let sortKey = "", sortDir = 1;          // 어느 칸으로, 어느 쪽으로
  let havePhoto = new Set();              // 사진이 있는 사람 (O/X 와 줄 세우기에)
  /* 표를 다시 그리는 손잡이.
     paint() 는 ui() 안에 있어 바깥에서 부를 수 없습니다. 전에는 여기서
     draw() 를 불렀는데 그런 함수가 없어, 얼굴 사진 폴더를 고르고 나면
     「폴더를 열지 못했습니다 — draw is not defined」 가 떴습니다
     (사진은 다음에 표를 그릴 때에야 붙었습니다). */
  let repaint = () => {};
  /* 폴더와 저장소에서 한 번에 모아 둡니다 — 그려진 줄만 봐서는
     3,859명을 사진으로 줄 세울 수 없습니다. */
  async function refreshPhotoNames() {
    try {
      havePhoto = await photoNames();
      if (document.getElementById("abTbl")) repaint();
    } catch (e) {}
  }

  /* ── 화면 그리기 ── */
  function ui() {
    /* 누가 동명이인인지 먼저 셉니다 — 사진 짝짓기가 여기에 기댑니다 */
    setTwins(rows);
    const not = document.getElementById("abNot");
    if (not) not.remove();          // 자료가 들어왔으니 안내는 치웁니다

    // 찾는 칸을 갈래 단추보다 위에 둡니다 — 먼저 찾고, 그다음 좁히는 차례라서.
    body.innerHTML =
      '<div class="nbar abbar">' +
        '<label class="nsearch nsearch--big"><span class="sr-only">찾기</span>' +
          '<input type="search" id="abQ" ' +
            'placeholder="이름 · 소속 · 직함 · 전공 · 전화 · 이메일로 찾기" autocomplete="off"></label>' +
        '<button type="button" class="nbtn nbtn--go" id="abGo">🔍 검색</button>' +
        '<select id="abMajor" class="nbtn asel"></select>' +
        '<button type="button" class="nbtn" id="abXls">⤓ 보이는 것만 엑셀로</button>' +
      "</div>" +
      '<nav class="ntabs" id="abTabs"></nav>' +
      '<p class="ncount" id="abCount"></p>' +
      '<div class="nimp__scroll"><table class="nimp__tbl" id="abTbl">' +
        '<thead><tr>' +
          /* 맨 앞은 일련번호 — 줄 세우는 칸이 아닙니다 */
          '<th class="ano">#</th>' +
          [["name", "이름"], ["company", "소속"], ["title", "직함"],
           ["major", "전공 · 학부"], ["tel", "연락처"], ["src", "출처"],
           ["photo", "사진"]]
            .map(([k, label]) =>
              `<th class="asort" data-s="${k}" title="눌러서 줄 세우기">` +
              `${label}<i></i></th>`).join("") +
        "</tr></thead>" +
        "<tbody></tbody></table></div>" +
      '<p class="nempty" id="abEmpty" hidden></p>' +
      '<div class="amore" id="abMore" hidden></div>' +
      '<div class="ndet" id="abDet"></div>';

    const q = document.getElementById("abQ");
    const sel = document.getElementById("abMajor");
    const tabs = document.getElementById("abTabs");
    const tbody = document.querySelector("#abTbl tbody");
    const countEl = document.getElementById("abCount");
    const emptyEl = document.getElementById("abEmpty");
    const moreEl = document.getElementById("abMore");

    // 전공 고르개 — 동문 자료에 실제로 있는 코드만 넣습니다
    const have = {};
    rows.forEach((r) => { if (r.major) have[r.major] = (have[r.major] || 0) + 1; });
    sel.innerHTML = '<option value="">전공 전체</option>' +
      Object.keys(have).sort((a, b) => have[b] - have[a]).map((k) =>
        `<option value="${esc(k)}">${esc(MAJORS[k] || k)} (${have[k]})</option>`).join("");

    const match = (r) => {
      const s = q.value.trim().toLowerCase();
      if (major && r.major !== major) return false;
      if (!s) return true;
      return [r.name, r.company, r.title, r.orgDept, r.univDept,
              r.majorName, r.major, r.email, r.mobile, r.phone, r.city, r.tag]
        .join(" ").toLowerCase().includes(s);
    };
    const inGroup = (r) => cur === "all" || (cur === "alum" ? r.src === "alum" : r.kind === cur);
    const shown = () => sortRows(
      rows.filter(inGroup).filter(match), sortKey, sortDir,
      (n, r) => !!findKey(havePhoto, n, r && r.company, isTwin(n)));

    function paint() {
      const l = shown();
      // 갈래 단추 — 지금 찾기말이 걸린 상태의 개수를 함께 셉니다
      tabs.innerHTML = GROUPS.map(([k, label]) => {
        const n = rows.filter((r) => k === "all" || (k === "alum" ? r.src === "alum" : r.kind === k))
                      .filter(match).length;
        return `<button type="button" data-k="${k}"${k === cur ? ' class="on"' : ""}>` +
               `${esc(label)}<span class="n">${n}</span></button>`;
      }).join("");
      tabs.querySelectorAll("button").forEach((b) =>
        b.addEventListener("click", () => { cur = b.dataset.k; shownCount = PAGE; paint(); }));

      countEl.textContent = `${GROUP_NAME[cur]} ${l.length}명` +
        (rows.length !== l.length ? ` · 모두 ${rows.length}명` : "");

      emptyEl.hidden = !!l.length;
      if (!l.length) { emptyEl.textContent = "찾으시는 분이 없습니다."; tbody.innerHTML = ""; }

      const part = l.slice(0, shownCount);
      tbody.innerHTML = part.map((r, i) =>
        `<tr data-i="${rows.indexOf(r)}">` +
          `<td class="ano">${i + 1}</td>` +
          `<td class="aface" data-n="${esc(r.name)}" data-o="${esc(r.company)}">` +
            `<b>${esc(r.name)}</b>` +
            `${r.nameKanji ? `<div class="asub">${esc(r.nameKanji)}</div>` : ""}</td>` +
          `<td>${esc(r.company)}${r.orgDept ? `<div class="asub">${esc(r.orgDept)}</div>` : ""}</td>` +
          `<td>${esc(r.title)}</td>` +
          `<td>${r.majorName ? `<b>${esc(r.majorName)}</b>` : ""}` +
            `${r.univDept ? `<div class="asub">${esc(r.univDept)}</div>` : ""}</td>` +
          `<td>${esc(r.mobile || r.phone)}` +
            `${r.email ? `<div class="asub">${esc(r.email)}</div>` : ""}</td>` +
          `<td><span class="ncat" style="--c:${GROUP_COLOR[r.src === "alum" ? "alum" : r.kind]}">` +
            `${esc(r.src === "alum" ? "동문" : GROUP_NAME[r.kind].replace("명함_", ""))}</span></td>` +
          /* 사진이 있는지 — 그린 뒤에 fillFaces 가 채웁니다 */
          (() => {
            const yes = !!findKey(havePhoto, r.name, r.company, isTwin(r.name));
            return '<td class="ahas ' + (yes ? "yes" : "no") + '" data-n="' +
                   esc(r.name) + '">' + (yes ? "O" : "X") + "</td>";
          })() +
        "</tr>").join("");

      /* 사진이 있는지 알아 두었다가 「사진」 칸으로 줄 세울 때 씁니다.
         알아낸 뒤에는 그 칸으로 세워 둔 상태면 다시 그립니다. */
      fillFaces(tbody);

      moreEl.hidden = l.length <= shownCount;
      moreEl.innerHTML = moreEl.hidden ? "" :
        `<button type="button" class="nbtn" id="abMoreBtn">더 보기 · ${l.length - shownCount}명 남음</button>`;
      const mb = document.getElementById("abMoreBtn");
      if (mb) mb.addEventListener("click", () => { shownCount += PAGE; paint(); });
    }

    /* 어느 칸으로 세워 두었는지 화살표로 보입니다.
       안 고른 칸에는 ↕ 를 흐리게 두어 「누를 수 있다」 를 알립니다. */
    function markSort() {
      document.querySelectorAll("#abTbl th.asort").forEach((x) => {
        const on = x.dataset.s === sortKey;
        x.classList.toggle("on", on);
        x.querySelector("i").textContent = on ? (sortDir === 1 ? "▲" : "▼") : "↕";
      });
    }
    markSort();

    /* 칸 이름을 누르면 그 칸으로 줄을 세웁니다. 같은 칸을 또 누르면 거꾸로. */
    document.querySelectorAll("#abTbl th.asort").forEach((th) =>
      th.addEventListener("click", () => {
        /* 한 번 누르면 그 칸으로, 또 누르면 거꾸로 — 그것뿐입니다.
           (전에는 세 번째에 원래 차례로 돌아가서, 눌러도 안 바뀌는 것처럼
            보였습니다.) */
        const k = th.dataset.s;
        if (sortKey !== k) { sortKey = k; sortDir = 1; }
        else { sortDir = -sortDir; }
        markSort();
        shownCount = PAGE;
        paint();
      }));

    // 줄 하나하나에 듣는 이를 붙이면 무겁습니다 — 표 하나에만 걸고 되짚습니다
    tbody.addEventListener("click", (e) => {
      const tr = e.target.closest("tr");
      if (tr) detail(rows[+tr.dataset.i]);
    });

    repaint = paint;                 // 바깥(사진 가져오기·폴더 고르기)에서도 다시 그리게
    const run = () => { shownCount = PAGE; paint(); };
    q.addEventListener("input", run);
    q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); run(); } });
    document.getElementById("abGo").addEventListener("click", () => { run(); q.focus(); });
    sel.addEventListener("change", () => { major = sel.value; shownCount = PAGE; paint(); });
    document.getElementById("abXls").addEventListener("click", () => download(shown()));
    paint();
  }

  /* ── 한 사람 자세히 ── */
  function detail(r) {
    if (!r) return;
    const box = document.getElementById("abDet");
    const line = (k, v) => (v ? `<div class="arow"><b>${esc(k)}</b><span>${esc(v)}</span></div>` : "");
    box.innerHTML =
      '<div class="ndet__box">' +
        '<button type="button" class="ndet__x" id="abX">✕</button>' +
        `<span class="ncat" style="--c:${GROUP_COLOR[r.src === "alum" ? "alum" : r.kind]}">` +
          `${esc(r.src === "alum" ? "동문" : GROUP_NAME[r.kind])}</span>` +
        `<h3>${esc(r.name)}${r.nameKanji ? ` <small>${esc(r.nameKanji)}</small>` : ""}</h3>` +
        /* 왼쪽은 적힌 것, 오른쪽은 얼굴 */
        '<div class="adet2">' +
          '<div class="alist">' +
            line("소속", r.company) + line("부서", r.orgDept) + line("직함", r.title) +
            line("전공", r.majorName) + line("학부", r.univDept) +
            line("학위", [r.degree, r.degreeYear].filter(Boolean).join(" ")) +
            line("연구실", r.lab) +
            line("휴대폰", r.mobile) + line("회사 전화", r.phone) +
            line("이메일", r.email) + line("주소", r.addr) +
            line("지역", r.city) + line("꼬리표", r.tag) + line("명함 등록", r.at) +
            line("메모", r.memo) +
          "</div>" +
          /* 사진 — 붙여넣기(Ctrl+V) · 끌어놓기 · 눌러서 고르기 */
          '<div class="aphoto" id="abPhoto" tabindex="0" ' +
            'title="사진을 붙여넣거나(Ctrl+V) 끌어다 놓으세요. 눌러서 고를 수도 있습니다">' +
            '<div class="aphoto__box" id="abPhotoBox">' +
              '<span class="aphoto__hint">얼굴 사진<br><b>Ctrl+V</b> 로 붙여넣기<br>' +
              '<small>끌어다 놓거나 눌러서 고르기</small></span>' +
            "</div>" +
            '<div class="aphoto__act" id="abPhotoAct"></div>' +
            '<input type="file" id="abPhotoFile" accept="image/*" hidden>' +
          "</div>" +
        "</div>" +
        '<div class="ndet__foot">' +
          /* 나중에 명함을 받으면 여기서 더 채워 넣습니다.
             엑셀은 리멤버가 주는 대로라 고칠 수 없어, 고친 것만 따로 담아
             엑셀 위에 덧씌웁니다. 엑셀을 새로 읽어도 남습니다. */
          '<button type="button" class="nbtn nbtn--go" id="abEdit">✎ 명함 내용 더하기</button>' +
          '<button type="button" class="nbtn" id="abClose">닫기</button>' +
        "</div>" +
      "</div>";
    box.classList.add("on");
    const shut = () => box.classList.remove("on");
    document.getElementById("abX").addEventListener("click", shut);
    document.getElementById("abClose").addEventListener("click", shut);
    box.onclick = (e) => { if (e.target === box) shut(); };
    /* 여기서 터지면 칸은 보이는데 아무것도 안 걸립니다 —
       조용히 죽지 말고 무엇이 잘못됐는지 알려 줍니다. */
    try { wirePhoto(r, box); }
    catch (e) { say("사진 칸을 붙이지 못했습니다 — " + (e && e.message)); }
    const edit = document.getElementById("abEdit");
    if (edit) edit.addEventListener("click", () => editForm(r, box));
  }

  /* ── 명함 내용 더하기 ──
     엑셀에서 온 값을 미리 채워 두고, 고치신 것만 따로 담습니다.
     비우면 그 칸은 엑셀 값으로 되돌아갑니다. */
  const EDIT_FIELDS = [
    ["company", "소속"], ["orgDept", "부서"], ["title", "직함"],
    ["mobile", "휴대폰"], ["phone", "회사 전화"], ["email", "이메일"],
    ["addr", "주소"], ["city", "지역"], ["tag", "꼬리표"],
  ];
  async function editForm(r, box) {
    const cur = (await getExtra(r.name, r.company)) || {};
    const val = (f) => (cur[f] != null ? cur[f] : (r[f] || ""));
    const wrap = box.querySelector(".alist");
    if (!wrap) return;
    wrap.innerHTML =
      '<p class="aedit__note">명함에서 보신 대로 고치시면 됩니다. ' +
        "여기서 고친 것은 <b>이 브라우저 안에만</b> 담기고, 엑셀을 새로 읽어도 남습니다. " +
        "비우면 엑셀 값으로 되돌아갑니다.</p>" +
      EDIT_FIELDS.map(([f, label]) =>
        '<label class="aedit"><b>' + esc(label) + "</b>" +
        '<input type="text" data-f="' + f + '" maxlength="200" value="' + esc(val(f)) + '"></label>').join("") +
      '<label class="aedit aedit--memo"><b>메모</b>' +
        '<textarea data-f="memo" rows="3" maxlength="1000" ' +
          'placeholder="만난 자리 · 하시는 일 · 다음에 기억할 것">' + esc(val("memo")) + "</textarea></label>" +
      '<div class="aedit__foot">' +
        '<button type="button" class="nbtn nbtn--go" id="abEditSave">저장</button>' +
        '<button type="button" class="nbtn" id="abEditCancel">취소</button>' +
      "</div>";
    const back = () => detail(rows.find((x) => x === r) || r);
    document.getElementById("abEditCancel").addEventListener("click", back);
    document.getElementById("abEditSave").addEventListener("click", async () => {
      const data = {};
      wrap.querySelectorAll("[data-f]").forEach((el) => { data[el.dataset.f] = el.value; });
      /* 엑셀 값과 똑같으면 담지 않습니다 — 덧쓴 것만 남겨 둡니다.
         (소속은 사람 열쇠라 바꾸면 다른 사람이 됩니다 — 그대로 담습니다.) */
      const keep = {};
      Object.keys(data).forEach((f) => {
        const v = String(data[f] || "").trim();
        if (v && v !== String(r[f] || "").trim()) keep[f] = v;
        else if (!v && r[f]) keep[f] = "";        // 일부러 비우신 것
      });
      if (!await saveExtra(r.name, r.company, keep)) { say("담지 못했습니다."); return; }
      /* 화면의 줄에도 곧바로 얹습니다 */
      Object.keys(keep).forEach((f) => { if (keep[f]) r[f] = keep[f]; });
      r.__extra = true;
      repaint();
      back();
      say(r.name + " 님의 내용을 담았습니다 — 이 브라우저 안에만 있습니다.");
    });
  }

  /* ── 얼굴 사진 붙이기 ──
     붙여넣은 그림은 이 브라우저 안(IndexedDB)에만 담깁니다.
     skyish.kr 에도 GitHub 에도 한 장도 올라가지 않습니다. */
  /* @param panel  자세히 보기 창(#abDet) — detail() 안의 지역 변수라
                    여기로 넘겨받아야 합니다. 전에는 그냥 box 라고 썼다가
                    「없는 이름」 이라 곧바로 터졌고, 그래서 붙여넣기·끌어놓기·
                    고르기가 하나도 안 걸렸습니다 (칸은 보이는데 안 먹던 까닭). */
  function wirePhoto(r, panel) {
    const wrap = document.getElementById("abPhoto");
    const boxEl = document.getElementById("abPhotoBox");
    const act = document.getElementById("abPhotoAct");
    const fileEl = document.getElementById("abPhotoFile");
    if (!wrap || !boxEl) return;

    const show = async () => {
      /* 어느 열쇠로 붙은 사진인가 —
         「이름」 만으로 담긴 옛 사진이면 동명이인이 나눠 쓰고 있는 것입니다.
         (NT로봇 김경환 님의 얼굴이 경기도청 김경환 님께 붙었던 일) */
      const key = await photoKeyOf(r.name, r.company);
      const shared = isSharedKey(key);
      const inFolder = key ? await fromFolder(key) : "";
      const u = await photo(r.name, r.company);
      if (u) {
        boxEl.innerHTML = '<img src="' + u + '" alt="' + esc(r.name) + '">';
        const twins = rows.filter((x) => photoKey(x.name) === photoKey(r.name)).length;
        act.innerHTML =
          (shared && twins > 1
            ? '<p class="aphoto__warn">이름만 보고 붙은 사진입니다 — ' +
              "같은 이름 " + twins + "분이 나눠 쓰고 있습니다.</p>" +
              '<button type="button" class="nbtn" id="abPhotoMine">이 분 것으로</button>'
            : "") +
          /* 폴더에서 온 그림이면 그 파일도 함께 지웁니다 — 안 그러면 지워도
             폴더에서 다시 읽혀 얼굴이 그대로 돌아옵니다. 되돌릴 수 없으니
             누르시면 무엇을 지우는지 밝히고 여쭙습니다. */
          (inFolder
            ? '<p class="aphoto__warn">9.FACE 폴더의 「' + esc(inFolder) + '」 입니다 — ' +
              "지우면 그 파일도 함께 지워집니다.</p>"
            : "") +
          '<button type="button" class="nbtn" id="abPhotoDel">' +
          (shared && twins > 1 ? "이 분 아님 (지우기)" : "사진 지우기") + "</button>";
        /* 「이 분 것으로」 — 소속을 붙인 열쇠로 옮겨 담고, 함께 쓰던 것은 치웁니다.
           그러면 같은 이름의 다른 분에게서는 사진이 사라집니다. */
        const mine = document.getElementById("abPhotoMine");
        if (mine) mine.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            const blob = await (await fetch(u)).blob();
            await savePhoto(r.name, blob, r.company);
            await dropPhoto(r.name, "");
            await show();
            await refreshPhotoNames();
            paintFacesNow();
            say(r.name + " 님(" + (r.company || "소속 없음") + ") 의 사진으로 지정했습니다.");
          } catch (err) { say("옮기지 못했습니다 — " + (err && err.message)); }
        });
        const del = document.getElementById("abPhotoDel");
        if (del) del.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (inFolder && !confirm(
              "9.FACE 폴더의 「" + inFolder + "」 파일을 지웁니다." + NL +
              "되돌릴 수 없습니다. 지울까요?")) return;
          await dropPhoto(r.name, shared ? "" : r.company);   // 브라우저 안 사본
          if (inFolder) {
            const gone = await removeFolderPhoto(key);
            if (!gone) {
              say("폴더의 파일은 지우지 못했습니다 — 「🙂 얼굴 사진 폴더」 로 " +
                  "9.FACE 를 다시 골라 쓰기를 허락해 주세요.");
            }
          }
          await show();
          await refreshPhotoNames();
          paintFacesNow();
        });
      } else {
        boxEl.innerHTML =
          '<span class="aphoto__hint">얼굴 사진<br><b>Ctrl+V</b> 로 붙여넣기<br>' +
          '<small>끌어다 놓거나 눌러서 고르기</small></span>';
        act.innerHTML = "";
        /* 이름은 같은데 소속이 안 맞아 못 붙은 사진이 있으면 물어봅니다 —
           동명이인이라 함부로 붙이지 않고, 주인이 골라 주시게. */
        const loose = await loosePhotoKeys(r.name);
        if (loose.length) {
          act.innerHTML =
            '<p class="aphoto__warn">같은 이름의 사진이 ' + loose.length + "장 있는데 " +
            "소속이 달라 안 붙였습니다.</p>" +
            loose.map((k, i) =>
              '<button type="button" class="nbtn" data-loose="' + esc(k) + '">' +
              "이 분 것 " + (loose.length > 1 ? "(" + (i + 1) + ")" : "") + "</button>").join("");
          act.querySelectorAll("[data-loose]").forEach((b) =>
            b.addEventListener("click", async (ev) => {
              ev.stopPropagation();
              const k = b.dataset.loose;
              try {
                const url = await photoByKey(k);
                if (!url) { say("그 사진을 열지 못했습니다."); return; }
                const blob = await (await fetch(url)).blob();
                await savePhoto(r.name, blob, r.company);
                await show();
                await refreshPhotoNames();
                paintFacesNow();
                say(r.name + " 님(" + (r.company || "소속 없음") + ") 의 사진으로 지정했습니다.");
              } catch (err) { say("옮기지 못했습니다 — " + (err && err.message)); }
            }));
        }
      }
    };

    const take = async (blob) => {
      if (!blob || !/^image\//.test(blob.type || "")) return;
      if (blob.size > 8 * 1024 * 1024) { say("사진이 8MB를 넘습니다."); return; }
      await savePhoto(r.name, blob, r.company);
      await show();
      await refreshPhotoNames();
      paintFacesNow();
      /* 폴더에도 되돌려 저장합니다 — 브라우저를 비워도 남게 */
      const saved = await saveToFaceFolder(r.name, blob, r.company);
      say(saved
        ? `${r.name} 님의 사진을 넣었습니다. 9.FACE 폴더에 「${saved}」 로도 저장했습니다.`
        : `${r.name} 님의 사진을 넣었습니다. ` +
          "(폴더에도 남기시려면 「🙂 얼굴 사진 폴더」 로 9.FACE 를 골라 주세요)");
    };

    /* 클립보드에서 그림을 꺼냅니다.
       두 자리를 다 봐야 합니다 —
         · files  : 파일 탐색기에서 그림 파일을 복사한 경우 여기에만 옵니다
         · items  : 웹에서 「이미지 복사」 한 경우 여기에 옵니다
       전에는 items 만 봐서, 탐색기에서 복사한 그림이 안 들어갔습니다. */
    const grabImage = (dt) => {
      if (!dt) return null;
      const f = [...(dt.files || [])].find((x) => /^image\//i.test(x.type || ""));
      if (f) return f;
      const it = [...(dt.items || [])]
        .find((x) => x.kind === "file" && /^image\//i.test(x.type || ""));
      return it ? it.getAsFile() : null;
    };

    /* 붙여넣기 — 창이 열려 있는 동안만 듣습니다 */
    const onPaste = (e) => {
      if (!panel.classList.contains("on")) return;
      const dt = e.clipboardData;
      const img = grabImage(dt);
      if (!img) {
        /* 그림이 아니면 조용히 넘기되, 무엇이 왔는지는 알려 드립니다 —
           「눌렀는데 아무 일도 안 일어난다」 가 가장 답답하니까요. */
        const kinds = [...((dt && dt.items) || [])].map((x) => x.type).filter(Boolean);
        if (kinds.length) {
          say("붙여넣은 것에 그림이 없습니다 (" + kinds.join(", ") + "). " +
              "그림을 복사하시거나, 칸을 눌러 파일을 고르세요.");
        }
        return;
      }
      e.preventDefault();
      take(img);
    };
    document.addEventListener("paste", onPaste);
    /* 창을 닫으면 듣기를 거둡니다 — 쌓이면 한 번 붙여넣기가 여러 번 돕니다 */
    const off = new MutationObserver(() => {
      if (!panel.classList.contains("on")) {
        document.removeEventListener("paste", onPaste);
        off.disconnect();
      }
    });
    off.observe(panel, { attributes: true, attributeFilter: ["class"] });

    ["dragenter", "dragover"].forEach((ev) =>
      wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) =>
      wrap.addEventListener(ev, () => wrap.classList.remove("over")));
    wrap.addEventListener("drop", (e) => {
      e.preventDefault();
      const f = grabImage(e.dataTransfer);
      if (f) take(f);
      else say("끌어다 놓으신 것이 그림이 아닙니다.");
    });
    wrap.addEventListener("click", (e) => {
      if (e.target.closest("#abPhotoDel")) return;
      fileEl.click();
    });
    fileEl.addEventListener("change", (e) => {
      const f = e.target.files[0]; e.target.value = "";
      if (f) take(f);
    });
    show();
  }

  /* 표에 이미 그려진 얼굴을 새로 고칩니다 (사진을 넣거나 지운 뒤) */
  function paintFacesNow() {
    const tb = document.querySelector("#abTbl tbody");
    if (!tb) return;
    tb.querySelectorAll("img.afaceimg").forEach((im) => im.remove());
    fillFaces(tb);
  }

  /* ── 보이는 것만 엑셀로 ── */
  function download(list) {
    const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const head = ["이름", "소속", "부서", "직함", "전공", "학부", "학위", "학위연도",
                  "휴대폰", "회사 전화", "이메일", "주소", "지역", "출처"];
    const lines = [head.map(q).join(",")].concat(list.map((r) => [
      r.name, r.company, r.orgDept, r.title, r.majorName, r.univDept, r.degree, r.degreeYear,
      r.mobile, r.phone, r.email, r.addr, r.city, r.src === "alum" ? "동문" : "명함첩",
    ].map(q).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")],
      { type: "text/csv;charset=utf-8" }));
    a.download = "주소록_" + list.length + "명.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /* ── 파일 읽어 들이기 ── */
  async function useFiles(files) {
    try {
      /* 나중에 명함 받아 채워 넣으신 것을 엑셀 위에 얹습니다 —
         엑셀을 새로 읽어도 손수 고친 것은 그대로 남습니다. */
      rows = applyExtras(dedupePeople(await loadFromFiles(files, say)), await allExtras());
    } catch (e) {
      say("읽지 못했습니다 — " + e.message);
      return;
    }
    if (!rows.length) {
      say("엑셀을 찾지 못했습니다. 「개인명함첩…」 「…주소록…」 이름의 파일이 든 폴더를 골라 주세요.");
      return;
    }
    const nCard = rows.filter((r) => r.src === "card").length;
    const nAlum = rows.length - nCard;
    say(`명함첩 ${nCard}명 · 동문 ${nAlum}명을 읽었습니다. ` +
        "겹친 것은 새 쪽으로 하나만 남겼습니다. 이 화면에만 있습니다.");
    ui();
    refreshPhotoNames();          // 누가 사진이 있는지 미리 모읍니다 (조용히)
    /* 폴더를 못 여는 곳(폰)에서는 담아 둡니다 — 다음부터 고르지 않아도 폅니다.
       컴퓨터는 폴더에서 늘 새로 읽으므로 담지 않습니다. */
    /* 담아 둘 때는 덧쓴 표시를 뺍니다 — 다시 열 때 새로 얹습니다 */
    if (!FSA) putCache(rows.map((r) => { const x = { ...r }; delete x.__extra; return x; }));
  }

  async function fromDir(dir) {
    const files = [];
    for await (const [, h] of dir.entries()) {
      if (h.kind !== "file") continue;
      if (!/\.xlsx?$/i.test(h.name) || /^~\$/.test(h.name)) continue;
      files.push(await h.getFile());
    }
    await useFiles(newestOfEachKind(files));
  }

  /* 같은 종류의 엑셀이 여럿 있으면 가장 새것 하나만 씁니다.
     리멤버는 내보낼 때마다 새 파일을 만들어서, 옛 파일이 남아 있으면
     한 사람이 두 번 나옵니다 (「현병천」 이 두 줄로 보이던 까닭). */
  function newestOfEachKind(files) {
    const best = new Map();
    (files || []).forEach((f) => {
      const kind = /명함/.test(f.name) ? "card"
        : /주소록|동문|동경대/.test(f.name) ? "alum" : f.name;
      const cur = best.get(kind);
      if (!cur || (f.lastModified || 0) > (cur.lastModified || 0)) best.set(kind, f);
    });
    return [...best.values()];
  }

  document.getElementById("abOpen").addEventListener("click", async () => {
    if (!FSA) { document.getElementById("abFiles").click(); return; }
    let dir;
    try {
      dir = await window.showDirectoryPicker({ id: "skyish-addr", mode: "read" });
    } catch (e) {
      if (e.name !== "AbortError") say("폴더를 열지 못했습니다 — " + e.message);
      return;
    }
    await putHandle(dir);
    await fromDir(dir);
  });

  /* 얼굴 사진 폴더 — 홈피 폴더의 face/ 를 한 번 골라 두시면 기억합니다 */
  const faceBtn = document.getElementById("abFace");
  if (faceBtn) faceBtn.addEventListener("click", async () => {
    try {
      if (!(await pickFaceFolder())) return;
      const n = await photoCount();
      say(n
        ? `얼굴 사진 ${n}장을 찾았습니다. 이름이 같은 분께 붙습니다.`
        : "그 폴더에서 그림을 찾지 못했습니다. 파일 이름을 그 사람 이름으로 지어 주세요 (예: 이석준.jpg).");
      await refreshPhotoNames();
      repaint();
    } catch (e) {
      if (e.name !== "AbortError") say("폴더를 열지 못했습니다 — " + e.message);
    }
  });

  /* 사진 꾸러미 내보내기 — 컴퓨터의 얼굴을 한 파일로.
     구글 드라이브에 두셨다 폰에서 「얼굴 사진 가져오기」 로 고르시면 됩니다. */
  const packBtn = document.getElementById("abPack");
  if (packBtn) packBtn.addEventListener("click", async () => {
    const was = packBtn.textContent;
    packBtn.disabled = true;
    packBtn.textContent = "묶는 중…";
    try {
      const { blob, n, nExtra } = await buildPhotoPack((k) => {
        packBtn.textContent = "묶는 중… " + k + "장";
      });
      if (!n && !nExtra) {
        say("묶을 것이 없습니다. 얼굴 사진을 넣으시거나 「✎ 명함 내용 더하기」 로 채워 주세요.");
        return;
      }
      const d = new Date();
      const p = (x) => String(x).padStart(2, "0");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = packFileName("" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()));
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      const mb = Math.round(blob.size / 1048576 * 10) / 10;
      say("얼굴 사진 " + n + "장" + (nExtra ? " · 채워 넣은 내용 " + nExtra + "건" : "") +
          "을 한 파일로 묶었습니다 (" + mb + "MB). " +
          "이 파일을 폰으로 옮기신 뒤 「얼굴 사진 가져오기」 로 고르시면 됩니다." +
          (mb > 40 ? " ※ 파일이 큽니다 — 폰에서 못 여실 수 있습니다." : ""));
    } catch (e) {
      say("묶지 못했습니다 — " + (e && e.message ? e.message : e));
    } finally {
      packBtn.disabled = false;
      packBtn.textContent = was;
    }
  });

  /* 얼굴 사진 가져오기 — 꾸러미든 그림이든. 이 브라우저에만 담깁니다. */
  const photosEl = document.getElementById("abPhotos");
  if (photosEl) photosEl.addEventListener("change", async (e) => {
    const list = [...e.target.files];
    e.target.value = "";
    if (!list.length) return;
    const kinds = sortPicked(list.map((f) => f.name));
    say("얼굴 사진을 담는 중…" + (kinds.packs.length ? " (꾸러미)" : ""));
    try {
      /* 주소록에 있는 이름만 담습니다 — 폰 사진첩의 「IMG_4821.JPG」 를 그대로 받으면
         담았다고 알리고도 얼굴은 한 장도 안 붙고, 지울 길 없는 그림만 쌓입니다. */
      const known = new Set();
      rows.forEach((r) => {
        const a = personKey(r.name, r.company);
        if (a) { known.add(a); known.add(photoKey(r.name)); }
      });
      const { n, people, skipped } = await importPhotos(list, (k) => {
        if (k % 20 === 0) say("얼굴 사진을 담는 중… " + k + "장");
      }, known.size ? known : null);
      /* 꾸러미에는 채워 넣은 내용도 들어 있습니다 — 표에 곧바로 얹습니다 */
      rows = applyExtras(rows, await allExtras());
      await refreshPhotoNames();
      repaint();
      const why = skipped.length
        ? NL + "못 담은 것 " + skipped.length + "개:" + NL + skipped.slice(0, 8).join(NL) +
          (skipped.length > 8 ? NL + "…" : "")
        : "";
      if (n) {
        say("얼굴 사진 " + n + "장(" + people + "분)을 이 브라우저에 담았습니다." +
            (skipped.length ? " 못 담은 것 " + skipped.length + "개." : ""));
        if (skipped.length) alert("담았습니다 — " + n + "장." + why);
      } else if (skipped.length) {
        say("담긴 것이 없습니다 — 까닭을 알려 드립니다.");
        alert("담긴 것이 없습니다." + why);
      } else {
        say("담을 것을 찾지 못했습니다.");
      }
    } catch (err) {
      say("담지 못했습니다 — " + (err && err.message ? err.message : err));
    }
  });

  const filesEl = document.getElementById("abFiles");
  if (filesEl) filesEl.addEventListener("change", (e) => {
    const f = [...e.target.files]; e.target.value = "";
    if (f.length) useFiles(f);
  });

  /* 폴더를 못 여는 곳(폰) — 담아 둔 주소록이 있으면 바로 폅니다.
     없으면 무엇을 하면 되는지 폰에 맞춰 알려 줍니다. */
  if (!FSA) {
    const c = await getCache();
    if (c && Array.isArray(c.rows) && c.rows.length) {
      rows = applyExtras(c.rows, await allExtras());
      const nCard = rows.filter((r) => r.src === "card").length;
      say(`담아 둔 명함첩 ${nCard}명 · 동문 ${rows.length - nCard}명 — 이 폰 브라우저에만 있습니다. ` +
          "새 엑셀을 읽히려면 「엑셀 고르기」.");
      ui();
    } else {
      const not = document.getElementById("abNot");
      if (not) not.innerHTML =
        "폰은 컴퓨터 폴더를 곧장 못 읽습니다.<br>" +
        "① 명함첩·동문 엑셀 두 파일을 폰에 한 번 내려받고<br>" +
        "② 「엑셀 고르기」 로 두 파일을 고르시면 —<br>" +
        "그 뒤로는 <b>저절로</b> 열립니다. 자료는 이 폰 브라우저 밖으로 안 나갑니다.<br><br>" +
        "<b>얼굴 사진</b>도 마찬가지입니다. 컴퓨터에서 「⤓ 사진 꾸러미」 로 한 파일을 " +
        "내려받아 폰으로 옮기신 뒤, 「🙂 얼굴 사진 가져오기」 로 그 파일을 고르시면 " +
        "얼굴이 함께 뜹니다.";
    }
    return true;
  }

  /* 지난번에 고른 폴더를 되살립니다.
       권한이 이미 있으면(granted)  → 누르지 않아도 바로 읽어 그립니다
       권한을 다시 물어야 하면(prompt) → 창은 사람이 누른 순간에만 뜰 수 있어
                                       「이어서 열기」 단추를 내놓습니다 */
  if (FSA) {
    const h = await getHandle();
    if (h) {
      const btn = document.getElementById("abAgain");
      const st = await h.queryPermission({ mode: "read" }).catch(() => "prompt");
      if (st === "granted") {
        btn.hidden = false;
        btn.textContent = "🔄 " + h.name + " 다시 읽기";
        btn.addEventListener("click", () => fromDir(h));
        say("「" + h.name + "」 을 여는 중…");
        // 권한이 이미 있으니 곧바로 폅니다 — 새로고침할 때마다 안 누르셔도 됩니다
        try { await fromDir(h); }
        catch (e) { say("폴더를 읽지 못했습니다 — 「" + btn.textContent + "」 을 눌러 주세요."); }
      } else if (st === "prompt") {
        btn.hidden = false;
        btn.textContent = "📂 " + h.name + " 이어서 열기";
        btn.addEventListener("click", async () => {
          const g = await h.requestPermission({ mode: "read" });
          if (g === "granted") await fromDir(h);
          else say("권한을 받지 못했습니다. 폴더를 다시 골라 주세요.");
        });
      }
    }
  }

  return true;
}
