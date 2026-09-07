// ─── 얼굴 사진 꾸러미 ──────────────────────────────────────
//
//  주소록의 얼굴 사진은 **내 컴퓨터**(9.FACE 폴더)와 **그 브라우저**
//  (IndexedDB) 안에만 있습니다. 어디로도 올라가지 않습니다 —
//  skyish.kr 에도, GitHub 에도, Supabase 에도.
//
//  그래서 컴퓨터에서 넣어 둔 얼굴이 폰 앱에서는 안 보입니다.
//  폰에는 그 폴더도, 그 브라우저의 저장소도 없으니까요.
//
//  옮기는 길은 둘입니다.
//    ① 사진 꾸러미  — 컴퓨터에서 한 파일로 내보내고, 폰에서 그 한 파일을
//                     고릅니다. 파일은 내 손을 떠나지 않습니다
//                     (구글 드라이브에 두셨다 폰에서 여시면 됩니다).
//    ② 그림 여러 장 — 폰에서 사진들을 곧바로 골라도 됩니다.
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험할 수 있습니다
//  (tools/test/addr-pack.mjs).

export const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

/** 이름을 열쇠로 — 띄어쓰기를 빼고 소문자로.
    「이 석준」 과 「이석준」 을 같은 사람으로 봅니다. */
export const photoKey = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

/** 파일 이름에서 사람 이름만 떼어 냅니다.
 *    「김형준_ASSETTA.jpg」   → 김형준
 *    「윤혜영 (인천연구원).png」→ 윤혜영
 *    「9.FACE/이석준.jpg」     → 이석준
 *  소속을 뒤에 붙여 저장한 규칙(이름_소속)을 그대로 따릅니다. */
export function nameFromFile(fname) {
  const base = String(fname || "").split(/[\\/]/).pop();
  return base.replace(IMG_EXT, "").split(/[_(]/)[0].trim();
}

/* ── 동명이인 ────────────────────────────────────────────
   사진을 **이름만으로** 짝지으면 동명이인이 같은 얼굴을 답니다.
   실제로 「NT로봇 대표 김경환」 의 얼굴이 「경기도청 김경환」 께 붙었고,
   김형준 두 분·윤혜영 두 분도 같은 얼굴을 나눠 달고 있었습니다.
   그래서 이름과 **소속**을 함께 열쇠로 씁니다.
   9.FACE 의 파일 이름 규칙(이름_소속.jpg)이 이미 소속을 담고 있습니다. */

/** 소속을 열쇠로 — 띄어쓰기와 흔한 꼬리말(주식회사·㈜·Inc…)을 뺍니다.
    「NT 로봇(주)」 과 「NT로봇」 을 같은 곳으로 봅니다. */
export function orgKey(s) {
  return String(s || "")
    .replace(/[（(].*?[）)]/g, " ")            // 괄호 안은 덧붙임말로 봅니다
    .replace(/(주식회사|유한회사|㈜|\(주\)|주\))/g, " ")
    .replace(/\b(inc|corp|corporation|co|ltd|llc)\b\.?/gi, " ")
    .replace(/[\s.,\-_·/]/g, "")
    .toLowerCase();
}

/** 사람 열쇠 — 소속이 있으면 「이름|소속」, 없으면 「이름」 */
export function personKey(name, org) {
  const n = photoKey(name);
  if (!n) return "";
  const o = orgKey(org);
  return o ? n + "|" + o : n;
}

/** 파일 이름을 이름과 소속으로 —
 *    「김경환_NT로봇.jpg」        → {name:"김경환", org:"NT로봇"}
 *    「윤혜영 (인천연구원).png」  → {name:"윤혜영", org:"인천연구원"}
 *    「이석준.jpg」               → {name:"이석준", org:""}
 *  소속이 여럿 붙어 있으면(이름_소속_부서) 첫 번째만 소속으로 봅니다. */
export function splitFileName(fname) {
  let base = String(fname || "").split(/[\\/]/).pop().replace(IMG_EXT, "");
  /* 윈도우·구글 드라이브가 붙이는 중복 표시를 버립니다 —
     「이석준 (1).jpg」 의 (1) 을 소속으로 읽으면 아무에게도 안 붙습니다. */
  base = base.replace(/\s*[(（]\s*\d+\s*[)）]\s*$/, "").trim();
  /* 밑줄을 괄호보다 먼저 봅니다.
     「김경환_NT로봇(주).jpg」 처럼 소속에 괄호가 들어 있으면, 괄호를 먼저 보다가
     이름이 「김경환_NT로봇」 이 되고 소속이 「주」 가 됩니다. */
  const us = base.indexOf("_");
  if (us > 0) {
    return { name: base.slice(0, us).trim(), org: base.slice(us + 1).split("_")[0].trim() };
  }
  const par = base.match(/^([^(（]+)[(（]([^)）]+)[)）]/);
  if (par) return { name: par[1].trim(), org: par[2].trim() };
  return { name: base.trim(), org: "" };
}

/** 9.FACE 에 되돌려 저장할 파일 이름의 앞부분 — 「이름_소속」.
 *  되읽었을 때 같은 사람으로 돌아와야 합니다. 그래서 소속에서
 *  괄호 덩이(㈜·(주) 따위)와 밑줄을 미리 걷어 냅니다 —
 *  안 걷으면 「김경환_NT로봇(주).jpg」 의 소속이 나중에 「주」 로 읽힙니다.
 *  @param safe 파일 이름에 못 쓰는 글자를 걸러 주는 함수 (addressbook.js 의 safeFileName)
 */
export function faceFileStem(name, org, safe) {
  const f = typeof safe === "function" ? safe : ((t) => String(t || ""));
  const tidy = (t) => f(t)
    .replace(/[（(].*?[）)]/g, " ")           // 괄호 덩이는 통째로 (orgKey 와 같은 규칙)
    .replace(/[_()（）]/g, " ")
    .replace(/\s+/g, " ").trim();
  const n = tidy(name);
  const o = tidy(org);
  return n + (o ? "_" + o : "");
}

/** 열쇠 목록을 배열로 (Set 이든 배열이든) */
const asList = (keys) => !keys ? []
  : Array.isArray(keys) ? keys
  : typeof keys.forEach === "function" ? [...keys] : [];

/** 이름은 같은데 소속이 다르거나 없는 열쇠들 — 「김경환」 「김경환|nt로봇」 … */
export function candidateKeys(keys, name) {
  const n = photoKey(name);
  if (!n) return [];
  return asList(keys).map(String).filter((k) => k === n || k.indexOf(n + "|") === 0);
}

/** 담아 둔 열쇠들 가운데 이 사람의 것.
 *
 *  주소록에 **동명이인이 있으면**(twin) 소속이 맞는 것만 붙입니다 —
 *  「NT로봇 대표 김경환」 의 얼굴이 「경기도청 김경환」 께 붙었던 일이 그것입니다.
 *
 *  동명이인이 없으면 느슨하게 봅니다. 9.FACE 에는 「김고은_부연구위원.jpg」 처럼
 *  밑줄 뒤가 소속이 아니라 **직함**인 파일이 많습니다. 그런 것까지 소속이 맞아야
 *  한다고 하면, 여태 잘 붙던 얼굴이 몽땅 사라집니다.
 *
 *  @param twin 이 이름이 주소록에 둘 이상 있는가
 *  @returns 붙일 열쇠, 없으면 빈 글자
 */
export function findKey(keys, name, org, twin) {
  const n = photoKey(name);
  if (!n) return "";
  const has = (k) => !!(keys && (typeof keys.has === "function"
    ? keys.has(k) : asList(keys).map(String).indexOf(k) >= 0));
  const exact = personKey(name, org);
  if (exact !== n && has(exact)) return exact;
  if (twin) return "";                       // 동명이인 — 소속이 맞아야만 붙입니다
  if (has(n)) return n;                      // 소속 없이 담아 둔 것
  const c = candidateKeys(keys, name);       // 「이름_직함.jpg」 같은 것
  return c.length === 1 ? c[0] : "";
}

/** 이 열쇠가 소속 없이 담긴 것인가 — 동명이인이 나눠 쓰고 있다는 뜻입니다 */
export const isSharedKey = (k) => !!k && String(k).indexOf("|") < 0;

/** 꾸러미 파일인가 */
export const isPack = (fname) => /\.json$/i.test(String(fname || ""));

/** 꾸러미 파일 이름 — 「얼굴사진_20260907.json」 */
export function packFileName(ymd) {
  const s = String(ymd || "").replace(/[^0-9]/g, "").slice(0, 8);
  return "얼굴사진" + (s ? "_" + s : "") + ".json";
}

/* 받아들이는 그림 — SVG 는 뺍니다. 그림처럼 보이지만 스크립트를 품을 수 있는
   문서라, blob 주소로 만들면 이 홈페이지 출처의 문서가 되어 버립니다. */
const OK_IMG = /^data:image\/(?!svg)[a-z+.-]+;base64,/i;

/** 덧쓴 내용에 담을 수 있는 칸 — 이것 말고는 담지 않습니다.
    남이 준 꾸러미에 엉뚱한 값이 섞여 들어오지 않게. */
export const EXTRA_FIELDS =
  ["company", "orgDept", "title", "mobile", "phone", "email", "addr", "city", "tag", "memo"];

/** [{key, data}] → 파일에 담을 글.
 *  data 는 「data:image/jpeg;base64,…」 꼴입니다.
 *  @param extras 나중에 명함 받아 채워 넣으신 것 (열쇠 → {칸: 값}). 없어도 됩니다. */
export function packText(items, extras) {
  const photos = {};
  (Array.isArray(items) ? items : []).forEach((x) => {
    if (!x) return;
    const k = photoKey(x.key);
    const d = String(x.data || "");
    if (!k || !OK_IMG.test(d)) return;
    photos[k] = d;
  });
  const extra = {};
  const src = extras && typeof extras.forEach === "function" ? extras : null;
  const put = (v, k) => {
    const key = photoKey(k);
    if (!key || !v || typeof v !== "object") return;
    const one = {};
    EXTRA_FIELDS.forEach((f) => {
      const t = String(v[f] == null ? "" : v[f]).trim();
      if (t) one[f] = t.slice(0, 1000);
    });
    if (Object.keys(one).length) extra[key] = one;
  };
  if (src) src.forEach(put);
  else if (extras) Object.keys(extras).forEach((k) => put(extras[k], k));
  return JSON.stringify({
    what: "skyish-얼굴사진", v: 2,
    n: Object.keys(photos).length, photos,
    nExtra: Object.keys(extra).length, extra,
  });
}

/** 꾸러미 글 → 덧쓴 내용 [{key, data}]. 아는 칸만 통과시킵니다. */
export function readExtras(text) {
  let j = null;
  try { j = JSON.parse(String(text || "")); } catch (e) { return []; }
  const src = j && typeof j === "object" && j.extra && typeof j.extra === "object" ? j.extra : null;
  if (!src) return [];
  const out = [];
  Object.keys(src).forEach((k) => {
    const key = photoKey(k);
    const v = src[k];
    if (!key || !v || typeof v !== "object") return;
    const one = {};
    EXTRA_FIELDS.forEach((f) => {
      const t = String(v[f] == null ? "" : v[f]).trim();
      if (t) one[f] = t.slice(0, 1000);
    });
    if (Object.keys(one).length) out.push({ key, data: one });
  });
  return out;
}

/** 꾸러미 글 → [{key, data}]. 이상한 것은 조용히 버립니다.
 *  남이 준 파일이 섞여 들어와도 그림이 아닌 것은 담지 않습니다. */
export function readPack(text) {
  let j = null;
  try { j = JSON.parse(String(text || "")); } catch (e) { return []; }
  const src = j && typeof j === "object" && j.photos && typeof j.photos === "object"
    ? j.photos : null;
  if (!src) return [];
  const out = [];
  Object.keys(src).forEach((k) => {
    const key = photoKey(k);
    const data = String(src[k] || "");
    /* SVG 는 받지 않습니다 — 그림처럼 보이지만 스크립트를 품을 수 있는 문서이고,
       blob 주소로 만들면 이 홈페이지 출처가 됩니다. 사진은 사진만. */
    if (key && OK_IMG.test(data) && /;base64,[A-Za-z0-9+/=]+$/.test(data)) {
      out.push({ key, data });
    }
  });
  return out;
}

/** 「data:image/jpeg;base64,…」 에서 그림 갈래만 */
export function dataUrlType(u) {
  const m = String(u || "").match(/^data:(image\/[a-z+.-]+);base64,/i);
  return m ? m[1].toLowerCase() : "";
}

/** 고른 파일들을 갈래별로 나눕니다 — 꾸러미 하나 · 그림 여럿 · 나머지 */
export function sortPicked(names) {
  const packs = [], imgs = [], other = [];
  (Array.isArray(names) ? names : []).forEach((n) => {
    const s = String(n || "");
    if (isPack(s)) packs.push(s);
    else if (IMG_EXT.test(s)) imgs.push(s);
    else other.push(s);
  });
  return { packs, imgs, other };
}
