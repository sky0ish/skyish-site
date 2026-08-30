// ─── BLOG — My Road… (나만 보는 기록) ────────────────────
// Schedule · Diary · 사람들 · 회의록 · 일상 · ETC.
// 「사람들」 만은 게시판이 아니라, Schedule·Diary 에서 만난 사람을 모아 보는 화면입니다.
// 글에 적힌 날짜를 알아채어 달력에 얹고, 엑셀로 내려받을 수 있습니다.
// 관리자만 보고 쓸 수 있습니다 (자료 쪽 규칙 notes_setup.sql 이 실제로 막습니다).
import { sb, currentUser, myProfile } from "../../auth/auth.js";
import * as NF from "./notes-files.js?v=202609050500";
import * as GC from "./gcal.js?v=202609050500";
import * as ST from "./notes-stats.js?v=202609050500";
import * as NW from "./notes-network.js?v=202609050500";
import { alumniNames } from "./addressbook.js?v=202609050500";

export const CATS = [
  ["schedule", "Schedule", "#4f9d92"],
  ["diary",    "Diary",    "#c98a3f"],
  ["people",   "사람들",   "#8a6bb0"],
  ["minutes",  "회의록",   "#b3543b"],
  ["daily",    "일상",     "#5c9e4a"],
  ["etc",      "ETC",      "#7d7768"],
];

/** 일반회원에게 열어 주는 갈래 — 「일상」만 봅니다 */
export const MEMBER_CATS = ["daily"];
export const CAT_NAME  = Object.fromEntries(CATS.map(([k, v]) => [k, v]));

/** 글을 쓸 수 있는 갈래 — 「사람들」 은 찾아보기 화면이라 뺍니다 */
export const PEOPLE_CAT = "people";
export const WRITE_CATS = CATS.filter(([k]) => k !== PEOPLE_CAT);

/** 주인 이메일 — 회원 정보 줄이 없어도 관리자로 봅니다 */
export const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];

/** 끌어올 구글 캘린더 — 이 계정으로 크롬에 로그인돼 있어야 보입니다 */
export const GCAL = "whlove@gmail.com";

/** 갈래마다 쓰는 말머리 — 여기 없는 갈래는 말머리 칸이 나오지 않습니다 */
export const TAGS = {
  schedule: ["발표", "토론", "자문회의", "자문참석", "위원회", "세미나참석", "GRI행사", "ETC"],
  minutes:  ["GRI", "도시일반", "건축일반", "주거", "균형발전", "산업", "일상", "ETC"],
};
// Diary 는 말머리를 쓰지 않습니다 — 일정이 아니라 그날 그날의 글이라서

/** 그 갈래에서 쓸 수 있는 말머리 */
export const tagsFor = (cat) => TAGS[cat] || [];
export const CAT_COLOR = Object.fromEntries(CATS.map(([k, , c]) => [k, c]));

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymd = (s) => (s || "").toString().slice(0, 10).replace(/-/g, ".");

/** 일기 제목에 넣을 오늘 — 2026.08.31 (일) */
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export function todayTitle(d) {
  const t = d || new Date();
  return `${t.getFullYear()}.${pad(t.getMonth() + 1)}.${pad(t.getDate())}` +
         ` (${WEEK[t.getDay()]})`;
}

/* ── 글에서 날짜 찾아내기 ────────────────────────────────────
   2026.09.14 · 2026-9-14 · 2026/9/14 · 26.9.14 · 9월 14일 · 9/14
   여러 개가 있으면 맨 앞의 것을 씁니다. 연도가 없으면 올해로 봅니다. */
export function findDate(text, today) {
  const s = String(text || "");
  const now = today || new Date();
  const mk = (y, m, d) => {
    y = +y; m = +m; d = +d;
    if (y < 100) y += 2000;
    if (!y || y < 1900 || y > 2200) return null;
    if (!m || m < 1 || m > 12) return null;
    if (!d || d < 1 || d > 31) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  let m;
  // 연도.월.일
  m = s.match(/(\d{4}|\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/);
  if (m) { const r = mk(m[1], m[2], m[3]); if (r) return r; }
  // 월 일 (연도 없음) — 올해로 봅니다
  m = s.match(/(\d{1,2})\s*[월/]\s*(\d{1,2})\s*일?/);
  if (m) { const r = mk(now.getFullYear(), m[1], m[2]); if (r) return r; }
  // 20260914
  m = s.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (m) { const r = mk(m[1], m[2], m[3]); if (r) return r; }
  return null;
}

/* ── 글에서 장소·사람 찾아내기 ──
   「장소: 세운상가」 「@세운상가」 「사람: 김철수, 이영희」 처럼 적으면 알아챕니다 */
export function findField(text, keys) {
  const s = String(text || "");
  for (const k of keys) {
    const m = s.match(new RegExp(k + "\\s*[:：]\\s*([^\\n]+)"));
    if (m) return m[1].trim().slice(0, 200);
  }
  return "";
}

/* ── 일기 제목에서 사람·장소 읽어내기 ──
   「2026.08.30 (일) 남편과 강남역」 처럼 적으시면
   사람 = 남편, 장소 = 강남역 으로 나눕니다.
   「치과」「학과」처럼 낱말 끝이 우연히 「과」인 것은 사람으로 보지 않습니다. */
const NOT_WHO =
  /^(치|내|외|안|산|한|약|학|공|이비인후|정형외|성형외|피부|신경외|소아|가정의학)$/;

export function fromDiaryTitle(title) {
  // 앞머리의 날짜·요일을 떼어 냅니다
  let t = String(title || "")
    .replace(/^\s*\d{2,4}\s*[.\-\/]\s*\d{1,2}\s*[.\-\/]\s*\d{1,2}\s*/, "")
    .replace(/^\s*\([일월화수목금토]\)\s*/, "")
    .trim();
  if (!t) return { people: "", place: "" };

  // 「A와/과/랑/이랑 B」 — 앞이 사람, 뒤가 장소
  const m = t.match(/^(.{2,30}?)(?:이랑|과|와|랑)\s+(.{1,40})$/);
  if (m) {
    const who = m[1].trim();
    if (!NOT_WHO.test(who)) {
      const where = m[2].trim().replace(/(에서|에|으로|로)$/, "").trim();
      return { people: who, place: where };
    }
  }

  // 「B에서 …」 — 장소만
  const m2 = t.match(/^(.{1,30}?)에서(?:\s|$)/);
  if (m2) return { people: "", place: m2[1].trim() };

  return { people: "", place: "" };
}

/* ── 맛집 적은 것 읽기 ──
   「옥동식 (한식, 서울 마포구 양화로7길 44)」 꼴로 적으시면
   이름 · 갈래 · 주소로 나눕니다. 여럿이면 세미콜론(;) 으로 잇습니다. */
export function foodCat(s) {
  const t = String(s || "");
  if (/한식|한정식|국밥|고기|백반|칼국수|냉면|족발|삼겹/.test(t)) return "kfood";
  if (/일식|스시|초밥|라멘|우동|돈카츠|돈까스|이자카야|사시미/.test(t)) return "jfood";
  if (/중식|중국|짜장|짬뽕|마라|훠궈|딤섬/.test(t)) return "cfood";
  if (/디저트|베이커리|빵|케이크|마카롱/.test(t)) return "dessert";
  if (/찻집|전통차|다원|다도/.test(t)) return "tea";
  if (/이색|테마/.test(t)) return "ucafe";
  if (/카페|까페|커피|브런치/.test(t)) return "cafe";
  return "efood";                    // 양식·아시아·분식·그 밖은 기타로
}

export function parseFood(text) {
  const out = [];
  String(text || "").split(/\s*[;\n]\s*/).map((x) => x.trim()).filter(Boolean)
    .forEach((one) => {
      let name = one, cat = "", addr = "";
      const m = one.match(/^(.+?)\s*[(（]\s*(.+?)\s*[)）]\s*$/);
      if (m) {
        name = m[1].trim();
        const p = m[2].split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
        if (p.length >= 2) { cat = p[0]; addr = p.slice(1).join(", "); }
        else { addr = p[0] || ""; }
      } else {
        const p = one.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
        if (p.length >= 3) { name = p[0]; cat = p[1]; addr = p.slice(2).join(", "); }
        else if (p.length === 2) { name = p[0]; addr = p[1]; }
      }
      if (name) out.push({ name, cat: foodCat(cat), catText: cat, addr });
    });
  return out;
}

/** 주소 하나를 OpenStreetMap 에 물어봅니다 */
async function ask(q) {
  const u = "https://nominatim.openstreetmap.org/search?format=json&limit=1" +
            "&countrycodes=kr&q=" + encodeURIComponent(q);
  try {
    const r = await fetch(u, { headers: { "Accept-Language": "ko" } });
    const j = await r.json();
    if (j && j[0]) return { lat: +j[0].lat, lng: +j[0].lon };
  } catch (e) {}
  return null;
}

/** 주소를 좌표로.
    한 번에 안 되면 뒤쪽 잔가지(건물이름·층·호)를 덜어 내며 다시 물어봅니다. */
export async function geoOf(addr) {
  const a = String(addr || "").trim();
  if (!a) return null;

  const tries = [a];
  // ① 도로명 + 건물번호 까지만 — 「… 강남대로 359 대우도씨에빛2 1층 112, 113호」 → 「… 강남대로 359」
  const road = a.match(/^(.*?(?:로|길)\s*\d+(?:-\d+)?)(?:\s|,|$)/);
  if (road && road[1] !== a) tries.push(road[1].trim());
  // ② 지번 주소 — 「… 동 123-4」 까지만
  const jibun = a.match(/^(.*?[동읍면리]\s*\d+(?:-\d+)?)(?:\s|,|$)/);
  if (jibun && tries.indexOf(jibun[1].trim()) < 0) tries.push(jibun[1].trim());
  // ③ 시·도 이름을 떼어 냅니다 — 가끔 이게 걸림돌이 됩니다
  const last = tries[tries.length - 1];
  const noCity = last.replace(/^(서울특별시|서울|부산광역시|부산|대구광역시|대구|인천광역시|인천|광주광역시|광주|대전광역시|대전|울산광역시|울산|세종특별자치시|세종|경기도|강원(?:특별자치)?도|충청북도|충북|충청남도|충남|전라북도|전북|전(?:라남|남)도|전남|경상북도|경북|경상남도|경남|제주(?:특별자치)?도|제주)\s*/, "");
  if (noCity !== last) tries.push(noCity);

  for (let i = 0; i < tries.length; i++) {
    if (i) await new Promise((r) => setTimeout(r, 1100));   // 잇달아 물으면 막힙니다
    const hit = await ask(tries[i]);
    if (hit) return hit;
  }
  return null;
}


/* ── 파일에서 뽑은 덩이를 본문에 얹기 ──
   덩이는 「━ 파일이름」 줄로 시작합니다. 같은 파일을 다시 읽으면
   그 덩이만 갈아 끼웁니다. 손으로 적으신 다른 글은 건드리지 않습니다. */
export function mergeBlock(body, name, text) {
  const NL = String.fromCharCode(10);
  const lines = String(body || "").split(NL);
  const head = "━ " + name;

  let a = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(head) === 0) { a = i; break; }
  }
  if (a < 0) {                                    // 처음 읽는 파일이면 뒤에 붙입니다
    const b0 = String(body || "").replace(/\s+$/, "");
    return b0 ? b0 + NL + NL + text : text;
  }

  let b = lines.length;                           // 다음 덩이가 시작되는 자리까지가 이 덩이
  for (let i = a + 1; i < lines.length; i++) {
    if (lines[i].indexOf("━ ") === 0) { b = i; break; }
  }
  const before = lines.slice(0, a);
  const after  = lines.slice(b);
  const tail   = after.length ? [""].concat(after) : [];
  return before.concat(text.split(NL), tail).join(NL).replace(/\s+$/, "");
}

/** 만난 사람 합치기 — notes-files.js 에 있습니다 (폴더 가져오기와 함께 씁니다) */
export const mergePeople = NF.mergePeople;

function friendly(m) {
  m = String(m || "");
  if (/schema cache|does not exist|relation/i.test(m))
    return "기록이 아직 켜지지 않았습니다 — auth/notes_setup.sql 을 한 번 실행해주세요.";
  if (/row-level security|policy|permission/i.test(m))
    return "권한이 없습니다. 관리자만 쓸 수 있습니다.";
  return m;
}

/* ── 글에서 시각 찾아내기 ──
   「시각: 14:00」 「시간: 14:00~16:00」 처럼 적혀 있으면 그것을,
   없으면 본문 어딘가의 14:00 꼴을 씁니다. */
export function findTime(text) {
  const s = String(text || "");
  const f = findField(s, ["시각", "시간", "time"]);
  if (f) {
    const m = f.match(/\d{1,2}\s*[:시]\s*\d{0,2}\s*(?:[-~–]\s*\d{1,2}\s*[:시]\s*\d{0,2})?/);
    if (m) return m[0].replace(/\s+/g, "");
    return f.slice(0, 30);
  }
  const m = s.match(/\b([01]?\d|2[0-3]):[0-5]\d(?:\s*[-~–]\s*([01]?\d|2[0-3]):[0-5]\d)?/);
  return m ? m[0].replace(/\s+/g, "") : "";
}

/* ── 엑셀에 넣을 「내용」 간추리기 ──
   본문에는 파일 이름·행사·사람 줄이 함께 들어 있습니다.
   그것들은 이미 제 칸이 따로 있으니 빼고,
   ① 내 이름이 든 대목이 있으면 그것만
   ② 없으면 핵심 줄만 짧게
   남깁니다. */
export function bodyDigest(body, cap) {
  const NL = String.fromCharCode(10);
  const raw = String(body || "");
  const flat = (t) => t.replace(/[.…]{3,}/g, " ").replace(/\s+/g, " ").trim();

  // 파일에서 뽑은 덩이가 하나도 없으면 손으로 적으신 글입니다 — 그대로 줄여 드립니다
  if (raw.indexOf("━") < 0 && raw.indexOf("◆") < 0) {
    const t = flat(raw);
    return t.length > 600 ? t.slice(0, 599) + "…" : t;
  }

  const mine = [], head = [];
  let mode = "";
  raw.split(NL).forEach((l) => {
    const t = l.trim();
    if (!t) return;
    if (t.charAt(0) === "━") { mode = ""; return; }            // 파일 이름 줄
    if (t.charAt(0) === "◆") { mode = /관련된/.test(t) ? "mine" : "head"; return; }
    // 다른 칸에 이미 있는 것은 빼 둡니다
    if (/^(행사|사람|시각|시간|장소|캘린더|역할|자료)\s*[:：]/.test(t)) return;
    (mode === "mine" ? mine : head).push(t.replace(/^·\s*/, ""));
  });

  const pick = mine.length ? mine : head;
  const out = pick.map(flat).filter(Boolean).join(" / ");
  const lim = cap || (mine.length ? 700 : 300);   // 내 이름이 없으면 더 짧게
  return out.length > lim ? out.slice(0, lim - 1) + "…" : out;
}

/* ── 엑셀로 내려받기 ──
   CSV 앞에 BOM 을 붙이면 엑셀에서 한글이 깨지지 않습니다. */
function toCSV(rows) {
  const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const head = ["날짜", "시간", "장소", "유형", "연락처", "만난 사람", "행사명", "제목", "내용"];
  const lines = [head.map(q).join(",")];
  rows.forEach((r) => lines.push([
    ymd(r.event_date),
    r.event_time || findTime(r.body),   // 칸이 비었으면 본문에서 찾아 씁니다
    r.place,
    r.tag || "",                        // 유형 = 말머리 (발표·토론·자문회의…)
    r.contact,
    r.people,
    r.event,
    r.title,
    bodyDigest(r.body),                 // 나와 관련된 대목만 · 없으면 핵심만 짧게
  ].map(q).join(",")));
  return "﻿" + lines.join("\r\n");
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ══════════════════════════════════════════════════════════ */
export async function initNotes(mountId = "notesapp") {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const user = await currentUser();
  const me = user ? await myProfile().catch(() => null) : null;
  const mail = ((user && user.email) || "").toLowerCase();
  const isAdmin  = !!(me && me.is_admin) || OWNERS.indexOf(mail) >= 0;
  /* 화면에서 관리자로 보는 것과, 자료 쪽(RLS)이 관리자로 보는 것은 다릅니다.
     auth/roles_setup.sql 을 안 돌리면 주인 메일이어도 자료 쪽은 막습니다. */
  let dbAdmin = null;
  try {
    const chk = await sb.rpc("is_admin");
    if (!chk.error) dbAdmin = !!chk.data;
  } catch (e) { /* 함수가 없으면 모르는 채로 둡니다 */ }
  const isMember = isAdmin || !!(me && me.analysis_access);

  if (!user) {
    mount.innerHTML =
      '<div class="nlocked"><h2>비공개 기록장입니다</h2>' +
      "<p>로그인하신 뒤 보실 수 있습니다.</p>" +
      '<p class="nlocked__sub"><a href="auth/login.html?next=%2Fblog.html">로그인 →</a></p></div>';
    return;
  }
  if (!isMember) {
    mount.innerHTML =
      '<div class="nlocked"><h2>승인을 기다리고 있습니다</h2>' +
      "<p>운영자가 승인하면 「일상」을 보실 수 있습니다.</p>" +
      '<p class="nlocked__sub"><a href="auth/mypage.html">내 정보 →</a></p></div>';
    return;
  }

  // 일반회원은 「일상」만 봅니다 (읽기만)
  const VIEW = isAdmin ? CATS : CATS.filter(([k]) => MEMBER_CATS.indexOf(k) >= 0);

  mount.innerHTML =
    /* Diary 를 폈을 때만 보이는 머리그림 — 맨 위에 두고 그 위에 이름을 얹습니다.
       그러면 위쪽 머리 칸을 접을 수 있어 화면이 넓어집니다. */
    '<figure class="ndiary" id="nDiaryBg" hidden>' +
      '<img src="assets/img/diary-bg.jpg" alt="" loading="lazy" decoding="async">' +
      '<figcaption class="ndiary__me">My WAY…</figcaption>' +
      '<figcaption class="ndiary__word">' +
        '<span class="ndiary__the">The</span>' +
        '<span class="ndiary__big">Diary</span>' +
        "<small>오늘의 한 쪽</small></figcaption>" +
    "</figure>" +
    '<nav class="ntabs" id="nTabs" aria-label="기록 갈래"></nav>' +
    /* 달력을 갈래 단추 바로 밑에 둡니다 — 먼저 달을 훑고,
       그다음 찾거나 새로 쓰는 차례라서. */
    '<div class="ngcal" id="nGcalBox" hidden></div>' +
    '<div class="ncal" id="nCalBox" hidden></div>' +
    '<div class="nbar">' +
      '<label class="nsearch"><span class="sr-only">찾기</span>' +
        '<input type="search" id="nQ" placeholder="제목 · 내용 · 장소 · 사람으로 찾기" autocomplete="off"></label>' +
      '<button type="button" class="nbtn" id="nGo">🔍 검색</button>' +
      '<button type="button" class="nbtn" id="nCal">📅 달력</button>' +
      '<button type="button" class="nbtn" id="nXls">⤓ 엑셀로 받기</button>' +
      '<button type="button" class="nbtn" id="nFill" ' +
        'title="붙임 파일이 있는 글을 모두 다시 읽어 행사명·만난 사람·요약을 채웁니다">' +
        "⟳ 요약 채우기</button>" +
      '<label class="nbtn nfolder" id="nFolderBtn" ' +
        'title="0_schedule 폴더를 고르면 행사마다 글을 만들어 드립니다">📁 폴더에서 가져오기' +
        '<input type="file" id="nFolder" webkitdirectory directory multiple hidden></label>' +
      '<button type="button" class="nbtn" id="nRec" title="1.Record/글로바꾼것 폴더를 고르세요">🎙 회의록 붙이기</button>' +
      '<button type="button" class="nbtn nbtn--go" id="nNew">✎ 새 글</button>' +
    "</div>" +
    '<p class="ncount" id="nCount"></p>' +
    '<div class="nlist" id="nList"></div>' +
    '<p class="nempty" id="nEmpty" hidden></p>' +
    '<div class="ndet" id="nDetail"></div>' +
    '<div class="ndet" id="nDay" role="dialog" aria-modal="true" aria-label="그날 일정">' +
      '<div class="ndet__box"></div></div>' +
    '<div class="nimp" id="nImp"></div>' +
    '<div class="nmodal" id="nModal" role="dialog" aria-modal="true" aria-label="글 쓰기">' +
      '<div class="nmodal__box">' +
        '<h3 id="nmTitle">새 글</h3>' +
        '<label for="nmCat">갈래</label><select id="nmCat"></select>' +
        '<div id="nmTagBox" hidden><label for="nmTag">말머리</label>' +
          '<select id="nmTag"></select></div>' +
        '<label for="nmT">제목</label>' +
        '<input type="text" id="nmT" maxlength="120" placeholder="예: 2026.09.14 세운상가 답사">' +
        '<label for="nmB">내용</label>' +
        '<textarea id="nmB" rows="7" placeholder="날짜를 적으면 달력에 저절로 올라갑니다.&#10;장소: 세운상가&#10;사람: 김철수, 이영희"></textarea>' +
        '<label for="nmE">행사명</label>' +
        '<input type="text" id="nmE" maxlength="200" ' +
          'placeholder="예: 2026년 한국지방자치학회 하계학술대회 (붙임 파일에서 저절로 찾습니다)">' +
        '<div class="nfrow">' +
          '<div><label for="nmD">날짜</label>' +
            '<input type="text" id="nmD" maxlength="12" placeholder="2026.09.14"></div>' +
          '<div><label for="nmTm">시간</label>' +
            '<input type="text" id="nmTm" maxlength="20" placeholder="14:00"></div>' +
          '<div><label for="nmP">장소</label>' +
            '<input type="text" id="nmP" maxlength="120"></div>' +
        "</div>" +
        '<div class="nfrow nfrow--2">' +
          '<div><label for="nmC">연락처</label>' +
            '<input type="text" id="nmC" maxlength="120" ' +
              'placeholder="폴더 이름의 ( ) 안에 적은 분"></div>' +
          '<div><label for="nmW">만난 사람</label>' +
            '<input type="text" id="nmW" maxlength="200"></div>' +
        "</div>" +
        '<label id="nmGcalBox" class="ngc" hidden>' +
          '<input type="checkbox" id="nmGcal" checked> 구글 캘린더에도 넣기' +
          '<span class="nlab">— 새 일정일 때만 · 내 캘린더(primary)로</span></label>' +
        '<div id="nmFoodBox" hidden>' +
          '<label for="nmFood">맛집 <span class="nlab">— 적으면 지도에 저절로 올라갑니다</span></label>' +
          '<input type="text" id="nmFood" maxlength="300" ' +
            'placeholder="옥동식 (한식, 서울 마포구 양화로7길 44)   ·  여럿이면 ; 로 잇습니다">' +
        "</div>" +
        '<label>붙임 파일</label>' +
        '<label class="ndrop" id="nmDrop">' +
          '<b>파일 고르기 · 끌어다 놓기 · 붙여넣기(Ctrl+V)</b>' +
          '<span id="nmDropMsg">그림 · 엑셀 · PDF · 문서를 올리실 수 있습니다. ' +
          '엑셀과 PDF 는 내 이름이 든 줄을 뽑아 아래에 적어 드립니다.</span>' +
          '<input type="file" id="nmFiles" multiple hidden>' +
        "</label>" +
        '<div class="nfiles" id="nmFileList"></div>' +
        '<div class="nredo">' +
          '<button type="button" class="nbtn nbtn--sm" id="nmRe">⟳ 붙임 파일 다시 읽기</button>' +
          '<span>예전에 올린 글도 이 단추로 행사명 · 만난 사람 · 요약을 채울 수 있습니다.</span>' +
        "</div>" +
        '<p class="nhint">제목과 내용에 날짜·장소·사람이 있으면 위 칸을 저절로 채워 드립니다. ' +
          '손으로 고치신 것은 다시 읽어도 지워지지 않습니다.</p>' +
        '<p class="nmsg" id="nmMsg"></p>' +
        '<div class="nmodal__foot">' +
          '<button type="button" class="nbtn nbtn--del" id="nmDel" hidden>지우기</button>' +
          '<span style="flex:1"></span>' +
          '<button type="button" class="nbtn" id="nmCancel">취소</button>' +
          '<button type="button" class="nbtn nbtn--go" id="nmSave">저장</button>' +
        "</div>" +
      "</div>" +
    "</div>";

  /* 일반회원에게는 쓰기 단추를 치웁니다.
     cur 는 아래에서 let 으로 만들어집니다. 선언보다 먼저 건드리면
     화면 전체가 멈추므로, 첫값 자리에서 정합니다. */
  if (!isAdmin) {
    ["nNew", "nXls", "nFill", "nFolderBtn"].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.remove();
    });
  }

  const tabs = document.getElementById("nTabs");
  const list = document.getElementById("nList");
  const q = document.getElementById("nQ");
  const countEl = document.getElementById("nCount");
  const emptyEl = document.getElementById("nEmpty");
  const calBox = document.getElementById("nCalBox");
  const modal = document.getElementById("nModal");
  const msg = document.getElementById("nmMsg");

  // 주소에 ?cat= 이 붙어 오면 그 갈래를 펴 놓습니다 (상단 차림표에서 옵니다)
  const wantCat = new URLSearchParams(location.search).get("cat");
  let rows = [], cur = isAdmin ? "all" : MEMBER_CATS[0], editing = null;
  let gEvents = [];   // 구글에서 받아 온 일정
  if (wantCat && CATS.some(([k]) => k === wantCat)) cur = wantCat;
  let calAt = new Date(); calAt.setDate(1);

  const mCat = document.getElementById("nmCat");
  mCat.innerHTML = WRITE_CATS.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  const mTag = document.getElementById("nmTag");
  const mTagBox = document.getElementById("nmTagBox");
  /* 말머리는 갈래마다 다릅니다. 갈래를 바꾸면 목록을 다시 그리되,
     고르셨던 값이 새 목록에도 있으면 그대로 둡니다. */
  const fillTags = (cat) => {
    const keep = mTag.value;
    const list = tagsFor(cat);
    mTag.innerHTML = '<option value="">(없음)</option>' +
      list.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    mTag.value = list.indexOf(keep) >= 0 ? keep : "";
  };
  // 말머리는 회의록에서만 씁니다
  /* 일기는 그날의 글이라 제목이 늘 날짜로 시작합니다.
     매번 손으로 적지 않도록 오늘로 채워 둡니다 (비어 있을 때만). */
  function stampToday() {
    const t = document.getElementById("nmT");
    const d = document.getElementById("nmD");
    if (!t.value.trim()) t.value = todayTitle();
    if (!d.value.trim()) d.value = ymd(iso(new Date()));
  }

  const syncTag = () => {
    fillTags(mCat.value);
    mTagBox.hidden = !tagsFor(mCat.value).length;
    // 맛집 칸 — 일기와 일정 둘 다에서 씁니다 (자문회의 뒤 들른 곳도 담을 수 있게)
    document.getElementById("nmFoodBox").hidden =
      (mCat.value !== "diary" && mCat.value !== "schedule");
    // 구글로 보내기는 「일정 새 글」 에서만 말이 됩니다
    document.getElementById("nmGcalBox").hidden =
      !(mCat.value === "schedule" && !editing && GC.ready());
    if (!editing && mCat.value === "diary") stampToday();
  };
  mCat.addEventListener("change", syncTag);

  async function load() {
    const r = await sb.from("notes").select("*")
                      .order("event_date", { ascending: false, nullsFirst: false })
                      .order("created_at", { ascending: false });
    if (r.error) {
      mount.innerHTML = '<p class="nempty">' + esc(friendly(r.error.message)) + "</p>";
      throw r.error;
    }
    rows = r.data || [];
    draw();
  }

  const catOf = (r) => r.category;   // Diary 는 이제 제 갈래로 섭니다

  /** 찾을 거리를 한 줄로 — 만난 사람도 그대로 들어갑니다.
      「김철수, 이소라」 처럼 여럿이어도 그중 한 사람만 치면 걸립니다. */
  const hayOf = (r) => [
    r.title, r.body, r.tag, r.place, r.people, r.event, r.contact,
    CAT_NAME[catOf(r)],
  ].filter(Boolean).join(" ").toLowerCase();

  const match = (r) => {
    const s = q.value.trim().toLowerCase();
    if (!s) return true;
    const hay = hayOf(r);
    // 낱말을 여럿 치면 모두 들어 있어야 합니다 — 「이소라 강남」
    return s.split(/\s+/).every((w) => hay.includes(w));
  };

  /** 찾는 중인가 — 찾을 때는 지금 보고 있는 갈래를 가리지 않고
      모든 게시판을 뒤집니다. Diary 를 보고 있어도 Schedule 의 글이 나옵니다. */
  const searching = () => q.value.trim().length > 0;
  const shown = () => rows
    .filter((r) => searching() || cur === "all" || catOf(r) === cur)
    .filter(match);

  /* ── 사람들 ──────────────────────────────────────────────
     게시판이 아닙니다. 모든 게시판의 「만난 사람」 칸을
     한자리에 모아 이름으로 찾아보는 화면입니다.
     이름을 누르면 그 사람과의 만남이 펼쳐지고, 다시 누르면 그 글로 갑니다. */
  let openWho = "";                    // 지금 펼쳐 둔 사람
  let almaSet = null;                  // 동경대 동문 이름 — 처음 그릴 때 한 번만 읽습니다

  /** 「홍길동 (경기연구원)」 에서 이름만 떼어 냅니다 — 같은 사람으로 묶으려고 */
  const bareName = (s) => String(s).replace(/\s*[(（].*$/, "").trim();

  function peopleIndex() {
    const map = new Map();
    rows.forEach((r) => {
      String(r.people || "").split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean)
        .forEach((one) => {
          const k = bareName(one);
          if (!k) return;
          const got = map.get(k) || { key: k, label: one, meets: [] };
          // 소속까지 적힌 쪽을 이름표로 씁니다
          if (one.length > got.label.length) got.label = one;
          if (got.meets.indexOf(r) < 0) got.meets.push(r);
          map.set(k, got);
        });
    });
    return [...map.values()].sort((a, b) =>
      b.meets.length - a.meets.length || a.key.localeCompare(b.key, "ko"));
  }

  function drawPeople() {
    const s = q.value.trim().toLowerCase();
    const all = peopleIndex();
    /* 이름으로도, 그 사람과 얽힌 글(제목·장소·행사)로도 찾습니다.
       「강남」 을 치면 강남에서 만난 사람들이 나옵니다. */
    const hit = all.filter((p) => !s ||
      p.label.toLowerCase().includes(s) ||
      p.meets.some((r) => s.split(/\s+/).every((w) => hayOf(r).includes(w))));

    const meets = hit.reduce((n, p) => n + p.meets.length, 0);
    countEl.textContent = `사람 ${hit.length}명 · 만남 ${meets}번` +
      (all.length !== hit.length ? ` · 모두 ${all.length}명` : "");

    if (!all.length) {
      list.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.textContent = "글의 「만난 사람」 칸을 채우시면 여기에 모입니다.";
      return;
    }
    emptyEl.hidden = true;

    /* 찾는 중일 때는 셈판을 접습니다 — 찾은 사람에 눈이 가야 하니까 */
    list.innerHTML = (s ? "" : statsHtml()) + peopleHtml(hit, s);
    wirePeople();
  }

  /* ── 셈판 ── 요약 · 달마다 · TOP 10 · 낱말 구름 ── */
  function statsHtml() {
    const sm = ST.summary(rows);
    const mm = ST.monthly(rows, 12);
    const top = ST.topPeople(rows, 10);

    /* ① 한눈 요약 */
    const card = (v, k) => `<div class="pstat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`;
    const head = '<div class="pstats">' +
      card(sm.people + "명", "만난 사람") +
      card(sm.meets + "번", "만난 자리") +
      card(sm.thisMonth + "명", "이번 달") +
      card(sm.most ? sm.most.label.replace(/\s*\(.*$/, "") : "—", "가장 자주") +
      "</div>";

    /* ② 달마다 — 지난 열두 달 */
    /* 잣대는 두 값 가운데 큰 쪽 — 같은 분을 다섯 번 만나면
       자리(5)가 사람(1)보다 커져, 사람만 잣대로 삼으면 막대가 넘칩니다 */
    const hi = Math.max(1, ...mm.map((x) => Math.max(x.people, x.meets)));
    const bars = '<section class="pbox"><h4>지난 열두 달' +
      '<span class="pleg"><i class="a"></i>만난 사람<i class="b"></i>만난 자리</span></h4>' +
      '<div class="pbars">' + mm.map((x) =>
        `<div class="pbar" title="${esc(x.ym)} — 사람 ${x.people}명 · 자리 ${x.meets}번">` +
          '<span class="pbar__v">' + (x.people || "") + "</span>" +
          '<span class="pbar__stack">' +
            `<i class="pbar__a" style="height:${Math.round(x.people / hi * 100)}%"></i>` +
            `<i class="pbar__b" style="height:${Math.round(x.meets / hi * 100)}%"></i>` +
          "</span>" +
          `<small>${esc(x.label)}</small>` +
        "</div>").join("") + "</div></section>";

    /* ③ TOP 10 */
    const thi = Math.max(1, top.length ? top[0].meets.length : 1);
    const rank = '<section class="pbox"><h4>가장 자주 만난 열 분</h4>' +
      '<ol class="ptop">' + top.map((p, i) => {
        const n = p.meets.length;
        return `<li><em>${i + 1}</em>` +
          `<button type="button" class="ptop__go" data-k="${esc(p.key)}">` +
            `<b>${esc(p.key)}</b>` +
            (p.org ? `<span class="ptop__org">${esc(p.org)}</span>` : "") +
          "</button>" +
          `<span class="ptop__bar"><i style="width:${Math.round(n / thi * 100)}%"></i></span>` +
          `<span class="ptop__n">${n}번</span></li>`;
      }).join("") + "</ol></section>";

    /* ④ 낱말 구름 — 사람 · 기관 · 행사 */
    const cloud = (title, arr, kind) => {
      const sc = ST.scale(arr);
      return '<div class="pcloud"><h5>' + esc(title) + "</h5>" +
        (sc.length
          ? '<div class="pcloud__in">' + sc.map((w) =>
              `<button type="button" class="pw" data-kind="${kind}" ` +
                `data-w="${esc(w.word)}" title="${esc(w.word)} — ${w.n}번" ` +
                `style="font-size:${(0.78 + w.t * 1.15).toFixed(2)}rem;` +
                `opacity:${(0.55 + w.t * 0.45).toFixed(2)}">` +
              esc(w.word) + "</button>").join("") + "</div>"
          : '<p class="pcloud__no">아직 모인 말이 없습니다.</p>') +
        "</div>";
    };
    const clouds = '<section class="pbox"><h4>말로 본 한 해' +
      '<span class="phint">글자가 클수록 자주 나온 말입니다 · 눌러서 좁혀 보세요</span></h4>' +
      '<div class="pclouds">' +
        cloud("① 사람", ST.wordsPeople(rows, 40), "who") +
        cloud("② 기관", ST.wordsOrg(rows, 40), "org") +
        cloud("③ 행사 낱말", ST.wordsEvent(rows, 40), "ev") +
      "</div></section>";

    /* 이 셈이 어느 자료를 다루는지 — 기간·건수·게시판을 밝혀 둡니다.
       기간이 안 적힌 그림은 읽는 사람이 「요즘 것」 으로 오해합니다. */
    const sp = ST.span(rows);
    const dot = (d) => (d || "").replace(/-/g, ".");
    const catBits = Object.entries(sp.byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => (CAT_NAME[k] || k) + " " + n + "건").join(" · ");
    const desc = sp.count
      ? '<p class="pdesc">이 셈판은 「만난 사람」 칸이 있는 글 <b>' + sp.count + "건</b>을 봅니다 — " +
        "<b>" + dot(sp.from) + " ~ " + dot(sp.to) + "</b>" +
        (sp.months > 1 ? " (" + ST.spanWord(sp.months) + " 치)" : "") +
        (catBits ? " · " + catBits : "") + ".<br>" +
        "「지난 열두 달」 막대만 최근 12개월이고, " +
        "TOP 10 · 관계망 · 낱말 구름은 이 기간 <b>전체</b>를 셉니다.</p>"
      : "";

    /* ⑤ 관계망 — 점은 사람, 글자 점은 기관·주제, 선은 함께한 횟수 */
    const hasAlma = !!(almaSet && almaSet.size);
    const net = '<section class="pbox"><h4>관계망' +
      '<span class="phint">점 = 사람 (크기·선 굵기 = 만난 횟수) · ' +
      '글자 점 = <i class="plg plg--org"></i>기관 · <i class="plg plg--topic"></i>행사 주제' +
      (hasAlma ? ' · <i class="plg plg--alma"></i>동경대 동문' : "") +
      ' · 점을 누르면 그 사람·그 말로 갑니다</span></h4>' +
      '<div class="pnet"><canvas id="pNet"></canvas>' +
      '<div class="pnet__tip" id="pNetTip" hidden></div>' +
      '<div class="pnet__card" id="pNetCard" hidden></div></div>' +
      /* 그림의 출처 — 보는 날을 기준으로, 어느 자료를 언제까지 센 것인지 */
      '<p class="pnet__src">기준일 <b>' + dot(iso(new Date())) + "</b> (그림을 여는 날마다 다시 셉니다)" +
      (sp.from ? " · 자료 <b>" + dot(sp.from) + " ~ " + dot(sp.to) + "</b> · 글 " + sp.count + "건" : "") +
      " · 출처: 이 게시판의 「만난 사람」·행사명·말머리·제목" +
      (hasAlma
        ? " · 동경대 총동문회 주소록 " + almaSet.size + "명 — 내 컴퓨터 안에서만 이름을 맞춰 보고, 어디로도 보내지 않습니다"
        : "") + "</p></section>";

    return head + desc + net + bars + rank + clouds;
  }

  /* ── 관계망 그리기 ──
     셈(그래프·자리)은 notes-network.js 가 하고, 여기서는 붓질만 합니다. */
  function drawNet(openPerson) {
    const cv = document.getElementById("pNet");
    if (!cv || typeof cv.getContext !== "function") return;   // 시험 틀에서는 조용히
    const box = cv.parentElement;
    const W = Math.max(340, box.clientWidth || 900);
    const H = Math.round(Math.min(560, Math.max(380, W * 0.48)));
    const dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.height = H + "px";

    /* 동문 명부는 처음 한 번만 읽습니다. 다 읽히면 그림을 새로 그립니다. */
    if (almaSet === null) {
      almaSet = new Set();               // 읽는 동안은 없는 셈 치고 먼저 그립니다
      alumniNames().then((got) => {
        if (got && got.size) {
          almaSet = got;
          if (cur === PEOPLE_CAT && !q.value.trim()) drawPeople();
        }
      }).catch(() => {});
    }
    const g = NW.layout(NW.buildGraph(rows, { alumni: almaSet }), W, H);
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* alma 의 옅은 파랑은 동경대의 상징색입니다 */
    const COL = { who: "#5c9e4a", org: "#d9822b", topic: "#c95fb0", alma: "#3d7dc0" };
    const maxW = Math.max(1, ...g.edges.map((e) => e.w));

    function paint(litId) {
      ctx.clearRect(0, 0, W, H);
      /* 선 — 끝점 가운데 글자 점 쪽 빛깔을 따릅니다. 사람끼리면 초록. */
      g.edges.forEach((e) => {
        const a = g.nodes[e.a], b = g.nodes[e.b];
        const lit = litId != null && (e.a === litId || e.b === litId);
        const c = COL[a.type !== "who" ? a.type : b.type];
        ctx.strokeStyle = c;
        ctx.globalAlpha = litId == null
          ? 0.13 + 0.35 * (e.w / maxW)
          : (lit ? 0.75 : 0.05);
        ctx.lineWidth = 0.6 + 2.8 * (e.w / maxW) + (lit ? 0.6 : 0);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      /* 점 */
      g.nodes.forEach((n) => {
        const dim = litId != null && n.id !== litId &&
          !g.edges.some((e) => (e.a === litId && e.b === n.id) || (e.b === litId && e.a === n.id));
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.fillStyle = COL[n.type];
        ctx.beginPath(); ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2); ctx.fill();
        if (n.type !== "who") {
          /* 글자 점 — 흰 테를 둘러 선 위에서도 읽히게 */
          ctx.font = "600 " + Math.round(11 + n.size * 0.45) + "px Pretendard, sans-serif";
          ctx.textAlign = "left"; ctx.textBaseline = "middle";
          const tx = n.x + n.size + 5, ty = n.y;
          ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(255,255,255,.92)";
          ctx.strokeText(n.label, tx, ty);
          ctx.fillStyle = "#3a362e";
          ctx.fillText(n.label, tx, ty);
        }
      });
      ctx.globalAlpha = 1;
    }
    paint(null);

    /* 어루만지기 — 가까운 점을 찾아 밝히고, 이름을 알려 줍니다 */
    const tip = document.getElementById("pNetTip");
    const near = (mx, my) => {
      let best = null, bd = 1e9;
      g.nodes.forEach((n) => {
        const d = Math.hypot(n.x - mx, n.y - my) - n.size;
        if (d < bd) { bd = d; best = n; }
      });
      return bd <= 8 ? best : null;
    };
    const at = (ev) => {
      const r = cv.getBoundingClientRect();
      return [ev.clientX - r.left, ev.clientY - r.top];
    };
    cv.onmousemove = (ev) => {
      const [mx, my] = at(ev);
      const n = near(mx, my);
      paint(n ? n.id : null);
      cv.style.cursor = n ? "pointer" : "";
      if (!n) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.textContent = n.type === "alma"
        ? "◎ 동경대 동문 — " + n.n + "명"
        : (n.type === "who" ? "○ " : n.type === "org" ? "◈ " : "# ") +
          n.label + " — " + n.n + "번";
      tip.style.left = Math.min(mx + 14, W - 150) + "px";
      tip.style.top = (my + 14) + "px";
    };
    cv.onmouseleave = () => { paint(null); tip.hidden = true; };
    /* ── 점을 누르면 뜨는 작은 카드 ── */
    const card = document.getElementById("pNetCard");
    const hideCard = () => { card.hidden = true; };

    function meetLine(r) {
      return `<button type="button" class="pnc__meet" data-id="${r.id}">` +
        `<span>${r.event_date ? ymd(r.event_date) : ""}</span>` +
        `<b>${esc(r.title)}</b></button>`;
    }

    function showCard(n, mx, my) {
      let head = "", body = "", foot = "";
      if (n.type === "alma") {
        // 내가 만난 사람 가운데 동문 명부와 이름이 같은 분들
        const hit = ST.byPerson(rows).filter((p) => almaSet.has(p.key));
        head = '<b class="pnc__name">◎ 동경대 동문</b>';
        body = `<p class="pnc__n">만난 사람 가운데 ${hit.length}명이 명부와 이름이 같습니다</p>` +
          `<p class="pnc__who">${esc(hit.map((p) =>
            p.key + " " + p.meets.length + "번").join(", "))}</p>` +
          '<p class="pnc__n">이름만 맞춰 본 것이라 동명이인일 수 있습니다.</p>';
        foot = "";
      } else if (n.type === "who") {
        // 이 사람과의 만남 — 요즘 것부터 석 줄
        const meets = rows.filter((r) =>
          ST.peopleOf(r).some((one) => ST.splitPerson(one).name === n.label))
          .sort((a, b) => String(b.event_date || "").localeCompare(String(a.event_date || "")));
        head = `<b class="pnc__name">○ ${esc(n.label)}</b>` +
          (n.org ? `<span class="pnc__org">◈ ${esc(n.org)}</span>` : "") +
          (almaSet && almaSet.has(n.label)
            ? '<span class="pnc__alma">◎ 동경대 동문 명부에 같은 이름이 있습니다</span>' : "");
        body = `<p class="pnc__n">${meets.length}번 만났습니다</p>` +
          meets.slice(0, 3).map(meetLine).join("");
        foot = `<button type="button" class="nbtn nbtn--go pnc__go" data-who="${esc(n.label)}">` +
          "만남 모두 보기 →</button>";
      } else {
        // 기관·주제 — 함께 나온 사람들
        const isOrg = n.type === "org";
        const hit = rows.filter((r) => isOrg
          ? (ST.peopleOf(r).some((one) => (ST.splitPerson(one).org || "").includes(n.label)) ||
             [r.event, r.title, r.place].filter(Boolean).join(" ").includes(n.label))
          : [r.event, r.tag, r.title].filter(Boolean).join(" ").includes(n.label));
        const who = [...new Set(hit.flatMap((r) =>
          ST.peopleOf(r).map((one) => ST.splitPerson(one).name)))];
        head = `<b class="pnc__name">${isOrg ? "◈" : "#"} ${esc(n.label)}</b>`;
        body = `<p class="pnc__n">${n.n}번 나왔습니다` +
          (who.length ? ` · 함께한 사람 ${who.length}명` : "") + "</p>" +
          (who.length
            ? `<p class="pnc__who">${esc(who.slice(0, 8).join(", "))}` +
              (who.length > 8 ? " …" : "") + "</p>"
            : "") +
          hit.slice(0, 2).map(meetLine).join("");
        foot = `<button type="button" class="nbtn nbtn--go pnc__go" data-q="${esc(n.label)}">` +
          "이 말로 찾기 →</button>";
      }
      card.innerHTML =
        '<button type="button" class="pnc__x" aria-label="닫기">✕</button>' +
        head + body + `<div class="pnc__foot">${foot}</div>`;
      card.hidden = false;
      // 틀 밖으로 나가지 않게 자리를 잡습니다
      const cw = Math.min(300, W - 24);
      card.style.width = cw + "px";
      card.style.left = Math.max(8, Math.min(mx + 12, W - cw - 8)) + "px";
      card.style.top = Math.max(8, Math.min(my + 12, H - 60)) + "px";

      card.querySelector(".pnc__x").onclick = hideCard;
      card.querySelectorAll(".pnc__meet").forEach((b) =>
        b.addEventListener("click", () =>
          detail(rows.find((x) => x.id === b.dataset.id))));
      const go = card.querySelector(".pnc__go");
      if (!go) return;
      go.onclick = () => {
        hideCard();
        if (go.dataset.who) { openPerson(go.dataset.who); return; }
        q.value = go.dataset.q;
        drawPeople();
      };
    }

    cv.onclick = (ev) => {
      const [mx, my] = at(ev);
      const n = near(mx, my);
      if (!n) { hideCard(); return; }
      paint(n.id);
      showCard(n, mx, my);
    };
  }

  /* ── 사람 알약들 ── */
  function peopleHtml(hit, s) {
    if (!hit.length) {
      return '<p class="nempty" style="margin:1.4rem 0">그런 사람을 못 찾았습니다.</p>';
    }
    return '<section class="pbox"><h4>' + (s ? "찾은 사람" : "만난 사람 모두") +
      `<span class="phint">${hit.length}명 · 이름을 누르면 그동안의 만남이 펼쳐집니다</span></h4>` +
      '<div class="npeople">' + hit.map((p) => {
        const on = p.key === openWho;
        return '<div class="nperson' + (on ? " on" : "") + '">' +
          `<button type="button" class="nperson__name" data-k="${esc(p.key)}" ` +
            `aria-expanded="${on}"><b>${esc(p.label)}</b>` +
            `<span class="n">${p.meets.length}</span></button>` +
          (on
            ? '<div class="nperson__meets">' + p.meets.map((r) =>
                `<button type="button" class="npmeet" data-id="${r.id}">` +
                  `<span class="ncat" style="--c:${CAT_COLOR[r.category] || "#888"}">` +
                    `${esc(CAT_NAME[r.category] || "")}</span>` +
                  `<span class="npmeet__t"><b>${esc(r.title)}</b>` +
                  (r.place ? `<small>⊙ ${esc(r.place)}</small>` : "") + "</span>" +
                  `<span class="npmeet__d">${r.event_date ? ymd(r.event_date) : ""}</span>` +
                "</button>").join("") + "</div>"
            : "") +
          "</div>";
      }).join("") + "</div></section>";
  }

  /** 셈판과 알약에 손을 달아 줍니다 */
  function wirePeople() {
    const openPerson = (k) => {
      openWho = (openWho === k) ? "" : k;
      drawPeople();
      const el = list.querySelector(".nperson.on");
      if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    drawNet(openPerson);                    // 관계망 (검색 중에는 칸 자체가 없습니다)
    list.querySelectorAll(".nperson__name").forEach((b) =>
      b.addEventListener("click", () => {
        openWho = (openWho === b.dataset.k) ? "" : b.dataset.k;
        drawPeople();
      }));
    list.querySelectorAll(".ptop__go").forEach((b) =>
      b.addEventListener("click", () => openPerson(b.dataset.k)));
    list.querySelectorAll(".npmeet").forEach((b) =>
      b.addEventListener("click", () => detail(rows.find((x) => x.id === b.dataset.id))));
    /* 낱말을 누르면 — 사람이면 그 사람을 펴고, 기관·행사면 그 말로 좁힙니다 */
    list.querySelectorAll(".pw").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.kind === "who") { openPerson(b.dataset.w); return; }
        q.value = b.dataset.w;
        drawPeople();
      }));
  }

  function draw() {
    const mk = (k, label) => {
      const n = (k === "all" ? rows : rows.filter((r) => catOf(r) === k)).filter(match).length;
      return `<button type="button" data-k="${k}"${k === cur ? ' class="on"' : ""}>` +
             `${esc(label)}<span class="n">${n}</span></button>`;
    };
    tabs.innerHTML = (isAdmin ? mk("all", "전체") : "") +
      VIEW.map(([k, v]) => mk(k, v)).join("");
    tabs.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        cur = b.dataset.k;
        const p = new URLSearchParams(location.search);
        if (cur === "all") p.delete("cat"); else p.set("cat", cur);
        history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
        draw();
        autoCal();
      }));

    const l = shown();
    countEl.textContent = searching()
      ? `「${q.value.trim()}」 — 모든 게시판에서 ${l.length}건`
      : `${cur === "all" ? "전체" : CAT_NAME[cur] || ""} ${l.length}건` +
        (rows.length !== l.length ? ` · 모두 ${rows.length}건` : "");

    // Diary 일 때만 머리그림을 폅니다. 그때는 위 머리 칸을 접어 자리를 내줍니다.
    const dbg = document.getElementById("nDiaryBg");
    const isDiary = (cur === "diary");
    if (dbg) dbg.hidden = !isDiary;
    document.body.classList.toggle("diary-on", isDiary);

    if (!calBox.hidden) drawCal();

    // 「사람들」 은 글 목록이 아니라 찾아보기 화면입니다
    if (cur === PEOPLE_CAT) { drawPeople(); return; }

    if (!l.length) {
      list.innerHTML = "";
      emptyEl.hidden = false;
      if (q.value.trim()) {
        emptyEl.textContent = "찾으시는 글이 없습니다.";
      } else if (rows.length) {
        emptyEl.textContent = "이 갈래에는 글이 없습니다.";
      } else if (dbAdmin === false) {
        /* 자료 쪽에서 관리자로 보지 않으면 오류 없이 0건으로 옵니다.
           「글이 없다」와 「못 보게 막혔다」를 가려 드립니다. */
        emptyEl.innerHTML =
          "<b>글이 없는 게 아니라, 지금 계정이 자료 쪽에서 관리자로 잡히지 않았습니다.</b><br>" +
          "들어온 계정 : " + esc(mail || "(모름)") + "<br>" +
          "Supabase SQL Editor 에서 <b>auth/roles_setup.sql</b> 을 한 번 돌리시면 " +
          "이 계정이 관리자가 되고 글이 다시 보입니다.";
      } else {
        emptyEl.textContent = "아직 적어둔 글이 없습니다.";
      }
      return;
    }
    emptyEl.hidden = true;
    list.innerHTML = l.map((r) => {
      const nf = Array.isArray(r.files) ? r.files.length : 0;
      const sub = [r.event ? "◇ " + esc(r.event) : "",
                   r.place ? "⊙ " + esc(r.place) : "",
                   r.people ? "○ " + esc(r.people) : "",
                   nf ? "□ " + nf : ""].filter(Boolean).join("   ");
      /* 단추 안에 단추를 넣을 수 없어, 줄은 상자로 두고
         「펴 보기」와 「지우기」를 나란히 둡니다. */
      return `<div class="nrow">` +
        `<button type="button" class="nrow__open" data-id="${r.id}">` +
          `<span class="ncat" style="--c:${CAT_COLOR[catOf(r)] || "#888"}">` +
            `${esc(CAT_NAME[catOf(r)] || "")}</span>` +
          `<span class="nrow__main">` +
            `<b>${r.tag ? `<span class="ntag">[${esc(r.tag)}]</span> ` : ""}${esc(r.title)}</b>` +
            (sub ? `<small>${sub}</small>` : "") +
          `</span>` +
          `<span class="nrow__date">${r.event_date ? ymd(r.event_date) : ""}</span>` +
        `</button>` +
        (isAdmin
          ? `<button type="button" class="nrow__del" data-id="${r.id}" ` +
            `title="이 글 지우기" aria-label="${esc(r.title)} 지우기">✕</button>`
          : "") +
      `</div>`;
    }).join("");

    list.querySelectorAll(".nrow__open").forEach((btn) =>
      btn.addEventListener("click", () => detail(rows.find((x) => x.id === btn.dataset.id))));
    list.querySelectorAll(".nrow__del").forEach((btn) =>
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        removePost(rows.find((x) => x.id === btn.dataset.id), btn);
      }));
  }

  /* ── 글 지우기 ──
     붙임 파일도 보관함에서 함께 치웁니다. 안 그러면 아무도 안 보는
     파일만 보관함에 쌓입니다. */
  async function removePost(r, btn) {
    if (!r) return false;
    const nf = Array.isArray(r.files) ? r.files.length : 0;
    if (!confirm(`「${r.title}」 을 지울까요?` +
                 (nf ? `${String.fromCharCode(10)}붙임 파일 ${nf}개도 함께 지웁니다.` : "") +
                 `${String.fromCharCode(10)}되돌릴 수 없습니다.`)) return false;
    if (btn) btn.disabled = true;
    const { error } = await sb.from("notes").delete().eq("id", r.id);
    if (error) {
      alert(friendly(error.message));
      if (btn) btn.disabled = false;
      return false;
    }
    // 글이 지워진 뒤에 파일을 치웁니다 (실패해도 글은 이미 없어졌습니다)
    for (const f of (Array.isArray(r.files) ? r.files : [])) {
      try { await NF.remove(f.path); } catch (e) {}
    }
    await load();
    return true;
  }

  /* ── 글 하나 자세히 보기 ── */
  async function detail(r) {
    if (!r) return;
    const box = document.getElementById("nDetail");
    const nf = Array.isArray(r.files) ? r.files : [];
    box.innerHTML =
      '<div class="ndet__box">' +
        '<button type="button" class="ndet__x" id="ndX">✕</button>' +
        `<span class="ncat" style="--c:${CAT_COLOR[catOf(r)] || "#888"}">` +
          `${esc(CAT_NAME[catOf(r)] || "")}</span>` +
        `<h3>${r.tag ? `<span class="ntag">[${esc(r.tag)}]</span> ` : ""}${esc(r.title)}</h3>` +
        '<p class="ndet__meta">' +
          (r.event_date ? `<b>${ymd(r.event_date)}</b>` : "") +
          (r.event_time ? ` <b>${esc(r.event_time)}</b>` : "") +
          (r.event ? ` · ◇ ${esc(r.event)}` : "") +
          (r.place ? ` · ⊙ ${esc(r.place)}` : "") +
          (r.contact ? ` · ✆ ${esc(r.contact)}` : "") +
          (r.people ? ` · ○ ${esc(r.people)}` : "") +
        "</p>" +
        (r.body ? `<div class="ndet__body">${esc(r.body).split(String.fromCharCode(10)).join("<br>")}</div>` : "") +
        (nf.length ? '<div class="nfilerow" id="ndFiles"></div>' : "") +
        '<div class="ndet__foot">' +
          (isAdmin ? '<button type="button" class="nbtn" id="ndEdit">✎ 고치기</button>' : "") +
          '<button type="button" class="nbtn" id="ndClose">닫기</button>' +
        "</div>" +
      "</div>";
    box.classList.add("on");

    const shut = () => box.classList.remove("on");
    document.getElementById("ndX").addEventListener("click", shut);
    document.getElementById("ndClose").addEventListener("click", shut);
    // onclick 으로 두어야 볼 때마다 새로 갈립니다 (addEventListener 는 쌓입니다)
    box.onclick = (e) => { if (e.target === box) shut(); };
    const ed = document.getElementById("ndEdit");
    if (ed) ed.addEventListener("click", () => { shut(); open(r); });

    // 붙임 파일 — 비공개라 볼 때마다 임시 주소를 받습니다
    if (nf.length) {
      const wrap = document.getElementById("ndFiles");
      const parts = [];
      for (const f of nf) {
        const u = await NF.signedUrl(f.path);
        if (!u) continue;
        parts.push(f.type === "image"
          ? `<a href="${u}" target="_blank" rel="noopener" class="nshot">` +
            `<img src="${u}" alt="${esc(f.name)}" loading="lazy"></a>`
          : `<a href="${u}" target="_blank" rel="noopener" class="nfile nfile--dl">` +
            `<b>${esc(f.name)}</b><em>${NF.niceSize(f.size || 0)}</em></a>`);
      }
      wrap.innerHTML = parts.join("");
    }
  }

  /* ── 달력 ── */
  /* 달력 칸의 빈 곳(항목·숫자 말고)을 누르면 그날을 모아 봅니다.
     calBox 는 안(innerHTML)만 갈리는 그릇이라 여기 한 번만 겁니다. */
  calBox.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;     // 일정·숫자·이동 단추는 제 일을 합니다
    const cell = e.target.closest(".ccell");
    if (cell && cell.dataset.day) dayView(cell.dataset.day);
  });

  /** 그날의 모든 일정을 한 창에 — 내 글과 구글 일정을 함께 폅니다 */
  function dayView(key) {
    const dbox = document.getElementById("nDay");
    const mine = rows.filter((r) => (r.event_date || "").slice(0, 10) === key)
      .sort((a, b) => String(a.event_time || "99:99").localeCompare(String(b.event_time || "99:99")));
    const g = gEvents.filter((x) => x.date === key);
    const d = new Date(key + "T00:00:00");

    dbox.querySelector(".ndet__box").innerHTML =
      '<button type="button" class="ndet__x" aria-label="닫기">✕</button>' +
      `<h3>${key.replace(/-/g, ".")} (${WEEK[d.getDay()]})</h3>` +
      `<p class="ndet__meta">내 글 ${mine.length}건` +
        (g.length ? ` · 구글 일정 ${g.length}건` : "") + "</p>" +
      '<div class="nperson__meets">' +
      mine.map((r) =>
        `<button type="button" class="npmeet" data-open="${r.id}">` +
          `<span class="ncat" style="--c:${CAT_COLOR[catOf(r)] || "#888"}">` +
            `${esc(CAT_NAME[catOf(r)] || "")}</span>` +
          `<span class="npmeet__t"><b>${esc(r.title)}</b>` +
            ((r.place || r.people)
              ? `<small>${r.place ? "⊙ " + esc(r.place) : ""}` +
                `${r.place && r.people ? "   " : ""}` +
                `${r.people ? "○ " + esc(r.people) : ""}</small>` : "") +
          "</span>" +
          `<span class="npmeet__d">${r.event_time ? esc(r.event_time) : ""}</span>` +
        "</button>").join("") +
      g.map((x, gi) =>
        `<button type="button" class="npmeet" data-gi="${gi}">` +
          `<span class="ncat" style="--c:${esc(x.color || "#4285f4")}">구글</span>` +
          `<span class="npmeet__t"><b>${esc(x.title)}</b>` +
            ((x.place || x.cal)
              ? `<small>${x.place ? "⊙ " + esc(x.place) : ""}` +
                `${x.place && x.cal ? "   " : ""}${x.cal ? esc(x.cal) : ""}</small>` : "") +
          "</span>" +
          `<span class="npmeet__d">${x.time ? esc(x.time) : ""}</span>` +
        "</button>").join("") +
      ((!mine.length && !g.length)
        ? '<p class="nempty" style="margin:.6rem 0">이날은 잡힌 일정이 없습니다.</p>' : "") +
      "</div>" +
      (isAdmin
        ? '<div class="ndet__foot">' +
          '<button type="button" class="nbtn" data-write="diary">✎ 이날 일기</button>' +
          '<button type="button" class="nbtn nbtn--go" data-write="schedule">📅 이날 일정 쓰기</button>' +
          "</div>"
        : "");

    dbox.classList.add("on");
    /* 듣는 이가 쌓이지 않게 onclick 하나로 받습니다 (자세히 보기와 같은 까닭) */
    dbox.onclick = (e2) => {
      if (e2.target === dbox || e2.target.closest(".ndet__x")) {
        dbox.classList.remove("on"); return;
      }
      const o = e2.target.closest("[data-open]");
      if (o) {
        const r = rows.find((x) => String(x.id) === o.dataset.open);
        if (r) { dbox.classList.remove("on"); detail(r); }
        return;
      }
      const gb = e2.target.closest("[data-gi]");
      if (gb && isAdmin) {
        const x = g[+gb.dataset.gi];
        if (x) { dbox.classList.remove("on"); fromGoogle(x); }
        return;
      }
      const w = e2.target.closest("[data-write]");
      if (w) {
        dbox.classList.remove("on");
        if (w.dataset.write === "diary") { newDiary(key); return; }
        open(null);
        mCat.value = "schedule";
        syncTag();
        document.getElementById("nmD").value = ymd(key);
      }
    };
  }

  function drawCal() {
    const y = calAt.getFullYear(), m = calAt.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const byDay = {};
    shown().forEach((r) => {
      if (!r.event_date) return;
      (byDay[r.event_date.slice(0, 10)] ||= []).push(r);
    });
    // 구글에서 받아 온 일정도 같은 칸에 얹습니다
    const gByDay = {};
    gEvents.forEach((e) => { (gByDay[e.date] ||= []).push(e); });
    const todayIso = iso(new Date());

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = iso(d);
      const out = d.getMonth() !== m;
      const items = (byDay[key] || []).map((r) =>
        `<button type="button" class="cev" data-open="${r.id}" ` +
        `style="--c:${CAT_COLOR[catOf(r)] || CAT_COLOR.schedule}" title="${esc(r.title)}">` +
        `${esc(r.title)}</button>`).join("")
        + (gByDay[key] || []).map((e, gi) =>
        `<${isAdmin ? "button type=\"button\"" : "span"} class="cev cev--g" ` +
        `style="--c:${esc(e.color || "#4285f4")}" ` +
        `${isAdmin ? `data-g="${key}|${gi}" ` : ""}` +
        `title="${esc(e.title)}${e.place ? " · " + esc(e.place) : ""}` +
        `${e.cal ? " · " + esc(e.cal) : ""}${isAdmin ? " — 누르면 글로 옮깁니다" : ""}">` +
        `${e.time ? esc(e.time) + " " : ""}${esc(e.title)}` +
        `</${isAdmin ? "button" : "span"}>`).join("");
      cells += `<div class="ccell${out ? " out" : ""}${key === todayIso ? " today" : ""}" data-day="${key}">` +
        (isAdmin
          ? `<button type="button" class="cday cdaybtn${d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : ""}" ` +
            `data-new="${key}" title="이 날 일기 쓰기">${d.getDate()}</button>`
          : `<span class="cday${d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : ""}">${d.getDate()}</span>`) +
        items + "</div>";
    }
    calBox.innerHTML =
      '<div class="chead">' +
        '<button type="button" class="cnav" id="cPrev">‹</button>' +
        `<b>${y}년 ${m + 1}월</b>` +
        '<button type="button" class="cnav" id="cNext">›</button>' +
        '<button type="button" class="cnav ctoday" id="cToday">오늘</button>' +
      "</div>" +
      '<div class="cgrid chdr">' +
        ["일", "월", "화", "수", "목", "금", "토"].map((d, i) =>
          `<div class="cwd${i === 0 ? " sun" : i === 6 ? " sat" : ""}">${d}</div>`).join("") +
      "</div>" +
      '<div class="cgrid">' + cells + "</div>";
    const hop = async (d) => {
      calAt.setMonth(m + d);
      if (GC.connected()) {
        try { gEvents = await GC.month(calAt.getFullYear(), calAt.getMonth()); } catch (e) {}
      }
      drawCal();
    };
    /* 내 글 일정을 누르면 그 글이 열립니다 */
    calBox.querySelectorAll("button[data-open]").forEach((b) =>
      b.addEventListener("click", () => {
        const r = rows.find((x) => String(x.id) === b.dataset.open);
        if (r) detail(r);
      }));

    /* 날짜 숫자를 누르면 그날 일기를 새로 씁니다 */
    calBox.querySelectorAll("button[data-new]").forEach((b) =>
      b.addEventListener("click", () => newDiary(b.dataset.new)));

    // 구글 일정을 누르면 그 내용으로 새 글을 씁니다
    if (isAdmin) {
      calBox.querySelectorAll("button[data-g]").forEach((b) =>
        b.addEventListener("click", () => {
          const [day, gi] = b.dataset.g.split("|");
          const e = (gEvents.filter((x) => x.date === day) || [])[+gi];
          if (e) fromGoogle(e);
        }));
    }
    document.getElementById("cPrev").addEventListener("click", () => hop(-1));
    document.getElementById("cNext").addEventListener("click", () => hop(1));
    document.getElementById("cToday").addEventListener("click", () => {
      calAt = new Date(); calAt.setDate(1); drawCal();
    });
  }

  /** 그날의 일기를 새로 씁니다 — 달력의 날짜 숫자에서 옵니다 */
  function newDiary(day) {
    open(null);
    mCat.value = "diary";
    syncTag();
    document.getElementById("nmD").value = ymd(day);
    const t = document.getElementById("nmT");
    if (!t.value.trim()) {
      const d = new Date(day + "T00:00:00");
      t.value = todayTitle(isNaN(d) ? new Date() : d);
    }
    t.focus();
    try { t.setSelectionRange(t.value.length, t.value.length); } catch (e) {}
    msg.textContent = "";
  }

  /* 구글 일정을 새 글로 옮깁니다 — Schedule 갈래로, 날짜·장소를 채워서 */
  function fromGoogle(e) {
    open(null);
    mCat.value = "schedule";
    syncTag();
    document.getElementById("nmT").value = e.title || "";
    document.getElementById("nmD").value = ymd(e.date);
    document.getElementById("nmP").value = e.place || "";
    const lines = [];
    if (e.time) lines.push("시각: " + e.time);
    if (e.place) lines.push("장소: " + e.place);
    if (e.cal) lines.push("캘린더: " + e.cal);
    document.getElementById("nmB").value = lines.join(String.fromCharCode(10));
    msg.textContent = "구글 일정을 옮겨 왔습니다. 고쳐서 저장하세요.";
  }

  /* ── 아래 칸 → 본문 자동 반영 ──────────────────────────────
     장소·시간·만난 사람·행사명을 고치면 본문의 해당 줄을 갈아 끼웁니다.
     본문에 그 줄이 없으면 맨 앞에 넣고, 칸을 비우면 줄을 지웁니다.
     손으로 쓴 다른 글은 건드리지 않습니다. */
  const SYNC = [
    ["nmTm", "시각"],
    ["nmP",  "장소"],
    ["nmW",  "만난 사람"],
    ["nmE",  "행사"],
  ];

  function syncBody(label, value) {
    const b = document.getElementById("nmB");
    const NL = String.fromCharCode(10);
    const re = new RegExp("^" + label + ":.*$", "m");
    const v = (value || "").trim();
    let t = b.value;

    if (!v) {                                   // 칸을 비우면 그 줄을 지웁니다
      if (!re.test(t)) return;
      t = t.replace(re, "").replace(/\n{3,}/g, NL + NL).replace(/^\n+/, "");
    } else if (re.test(t)) {                    // 있으면 갈아 끼웁니다
      t = t.replace(re, label + ": " + v);
    } else {                                    // 없으면 맨 앞에 넣습니다
      t = label + ": " + v + (t ? NL + t : "");
    }
    if (t !== b.value) { b.value = t; dirty = true; }
  }

  SYNC.forEach(([id, label]) => {
    const el = document.getElementById(id);
    if (!el) return;
    // 다 치고 칸을 떠날 때 한 번만 — 한 글자마다 본문이 들썩이면 성가십니다
    el.addEventListener("change", () => syncBody(label, el.value));
    el.addEventListener("blur",   () => syncBody(label, el.value));
  });

  /* ── 글 쓰기·고치기 ── */
  function open(row) {
    editing = row || null;
    dirty = false;                       // 새로 여는 것이므로 고친 것이 없습니다
    document.getElementById("nDetail").classList.remove("on");   // 위에 덮인 창을 걷습니다
    document.getElementById("nmTitle").textContent = row ? "글 고치기" : "새 글";
    document.getElementById("nmDel").hidden = !row;
    mCat.value = row ? row.category
                     : ((cur === "all" || cur === PEOPLE_CAT) ? "schedule" : cur);
    if (!mCat.value) mCat.value = "etc";   // 없어진 갈래의 옛 글을 열었을 때
    document.getElementById("nmT").value = row ? row.title || "" : "";
    document.getElementById("nmB").value = row ? row.body || "" : "";
    document.getElementById("nmE").value = row ? row.event || "" : "";
    /* 본문에 남아 있는 「맛집: …」 을 칸으로 되돌립니다.
       그래야 예전 글을 열어 저장만 해도 지도에 올라갑니다. */
    const fm = row && row.body ? String(row.body).match(/^맛집:[ \t]*(.+)$/m) : null;
    document.getElementById("nmFood").value = fm ? fm[1].trim() : "";
    autoFill.people = ""; autoFill.place = "";
    document.getElementById("nmD").value = row ? ymd(row.event_date) : "";
    document.getElementById("nmTm").value = row ? row.event_time || "" : "";
    document.getElementById("nmC").value = row ? row.contact || "" : "";
    document.getElementById("nmP").value = row ? row.place || "" : "";
    document.getElementById("nmW").value = row ? row.people || "" : "";
    fillTags(mCat.value);
    mTag.value = row ? (row.tag || "") : "";
    syncTag();
    picked = [];
    attached = (row && Array.isArray(row.files)) ? row.files.slice() : [];
    drawFiles();
    msg.textContent = "";
    modal.classList.add("on");
    if (!row && mCat.value === "diary") stampToday();
    const t = document.getElementById("nmT");
    t.focus();
    // 이어서 쓰기 좋게 커서를 끝에. 이 한 줄 때문에 창이 안 열리면 안 되므로 감쌉니다.
    try { t.setSelectionRange(t.value.length, t.value.length); } catch (e) {}
  }
  /* 저장하는 동안에는 창이 닫히지 않게 잠급니다.
     고치던 글이 있는데 바깥을 잘못 눌러 창이 사라지면 적은 것이 날아갑니다. */
  let busy = false;      // 저장·올리기가 도는 중
  let dirty = false;     // 무언가 고치셨는지

  const close = () => { dirty = false; modal.classList.remove("on"); };
  const tryClose = () => {
    if (busy) return;                                  // 저장 중에는 안 닫습니다
    if (dirty && !confirm("적으신 것이 저장되지 않았습니다. 그래도 닫을까요?")) return;
    close();
  };

  // 글쓰기 창 안에서 무엇이든 건드리면 「고치는 중」으로 봅니다
  modal.addEventListener("input", () => { dirty = true; });
  modal.addEventListener("change", () => { dirty = true; });

  const nNewBtn = document.getElementById("nNew");
  if (nNewBtn) nNewBtn.addEventListener("click", () => open(null));
  document.getElementById("nmCancel").addEventListener("click", tryClose);
  /* 바깥을 눌러도 닫지 않습니다.
     글을 적는 창이라, 칸 옆 빈 곳을 잘못 눌렀다고 적던 것이 사라지면 안 됩니다.
     닫으실 때는 「취소」나 Esc 를 쓰십시오. */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("on")) tryClose();
  });

  /* ── 붙임 파일 ── */
  let picked = [];              // 아직 안 올린 것
  let attached = [];            // 이미 올라간 것 (고칠 때)
  const fList = document.getElementById("nmFileList");
  const fDrop = document.getElementById("nmDrop");
  const fMsg  = document.getElementById("nmDropMsg");

  function drawFiles() {
    const chip = (f, i, isNew) =>
      '<span class="nfile" data-i="' + i + '" data-new="' + (isNew ? 1 : 0) + '">' +
      '<b>' + esc(f.name) + "</b>" +
      '<em>' + NF.niceSize(f.size || 0) + "</em>" +
      '<button type="button" title="빼기">✕</button></span>';
    fList.innerHTML =
      attached.map((f, i) => chip(f, i, false)).join("") +
      picked.map((f, i) => chip(f, i, true)).join("");
    fList.querySelectorAll(".nfile button").forEach((b) =>
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        const el = b.closest(".nfile");
        const i = +el.dataset.i;
        if (el.dataset.new === "1") picked.splice(i, 1); else attached.splice(i, 1);
        drawFiles();
      }));
    const bits = [];
    if (attached.length) bits.push("이미 올라간 파일 " + attached.length + "개");
    if (picked.length)   bits.push("새로 담은 " + picked.length + "개 (저장할 때 올라갑니다)");
    fMsg.textContent = bits.length
      ? bits.join(" · ")
      : "그림 · 엑셀 · PDF · 문서를 올리실 수 있습니다. 엑셀과 PDF 는 내 이름이 든 줄을 뽑아 아래에 적어 드립니다.";
  }

  /* 파일 하나에서 뽑은 것을 글에 얹습니다.
     손으로 적어 두신 것은 지우지 않습니다 —
     행사명은 비었을 때만 채우고, 사람은 있는 것에 더하고,
     본문은 같은 파일의 옛 덩이만 갈아 끼웁니다. */
  async function applyOne(f, opt) {
    const body  = document.getElementById("nmB");
    const evEl  = document.getElementById("nmE");
    const whoEl = document.getElementById("nmW");
    let r;
    try { r = await NF.extract(f); }
    catch (err) { r = { total: 0, mine: [], head: [], people: [], event: "", error: err.message }; }

    const t = NF.asText(f.name, r);
    if (t) body.value = mergeBlock(body.value, f.name, t);

    autofill();   // 본문이 바뀐 뒤 날짜·장소를 먼저 훑습니다

    if (r.event && (!evEl.value.trim() || (opt && opt.force))) evEl.value = r.event;
    if (r.people && r.people.length) whoEl.value = mergePeople(whoEl.value, r.people);
    return r;
  }

  async function addFiles(list) {
    const arr = [...list];
    if (!arr.length) return;
    dirty = true;
    picked = picked.concat(arr);
    drawFiles();
    for (const f of arr) {
      const k = NF.kind(f);
      if (k === "image" || k === "file") continue;
      fMsg.textContent = f.name + " 에서 글을 뽑는 중…";
      const r = await applyOne(f);
      if (r.error) fMsg.textContent = f.name + " — " + r.error;
    }
    drawFiles();
  }

  /* 이미 올라간 붙임 파일을 도로 내려받아 다시 읽습니다.
     예전에 올린 글도 이 단추로 요약·사람·행사명을 채울 수 있습니다. */
  async function reExtract(btn) {
    const all = attached.concat(picked.map((f) => ({ name: f.name, _file: f })));
    const todo = all.filter((f) => {
      const k = NF.kind(f._file || { name: f.name, type: "" });
      return k !== "image" && k !== "file";
    });
    if (!todo.length) { fMsg.textContent = "다시 읽을 엑셀·PDF·문서가 없습니다."; return; }

    if (btn) btn.disabled = true;
    dirty = true;
    busy = true;
    for (let i = 0; i < todo.length; i++) {
      const f = todo[i];
      fMsg.textContent = "다시 읽는 중… (" + (i + 1) + "/" + todo.length + ") " + f.name;
      try {
        const file = f._file || await NF.fileFromStore(f);
        await applyOne(file, { force: true });
      } catch (err) {
        fMsg.textContent = f.name + " — 내려받지 못했습니다: " + friendly(err.message);
      }
    }
    busy = false;
    if (btn) btn.disabled = false;
    fMsg.textContent = todo.length + "개를 다시 읽었습니다. 확인하시고 저장을 눌러 주세요.";
  }

  document.getElementById("nmRe").addEventListener("click", (e) => reExtract(e.target));

  document.getElementById("nmFiles").addEventListener("change", (e) => {
    addFiles(e.target.files); e.target.value = "";
  });
  fDrop.addEventListener("dragover", (e) => { e.preventDefault(); fDrop.classList.add("over"); });
  fDrop.addEventListener("dragleave", () => fDrop.classList.remove("over"));
  fDrop.addEventListener("drop", (e) => {
    e.preventDefault(); fDrop.classList.remove("over");
    addFiles(NF.filesFrom(e));
  });
  document.addEventListener("paste", (e) => {
    if (!modal.classList.contains("on")) return;
    const f = NF.filesFrom(e);
    if (f.length) { e.preventDefault(); addFiles(f); }
  });

  /* 제목·내용을 적으면 날짜·장소·사람을 저절로 채웁니다 (비어 있을 때만) */
  /* 제목에서 저절로 넣은 값을 적어 둡니다.
     그 값 그대로면 계속 고쳐 쓰고, 손대신 뒤에는 그냥 둡니다. */
  const autoFill = { people: "", place: "" };

  function autofill() {
    const text = document.getElementById("nmT").value + "\n" + document.getElementById("nmB").value;
    const dEl = document.getElementById("nmD");
    const pEl = document.getElementById("nmP");
    const wEl = document.getElementById("nmW");
    if (!dEl.value) { const d = findDate(text); if (d) dEl.value = ymd(d); }
    const tEl = document.getElementById("nmTm");
    if (!tEl.value) { const t = findTime(text); if (t) tEl.value = t; }
    // 「장소:」 「사람:」 을 적으시면 늘 그 값으로 맞춥니다.
    // 비었을 때만 채우면, 적어 넣어도 칸이 그대로여서 헷갈립니다.
    const p = findField(text, ["장소", "place", "위치"]);
    if (p) pEl.value = p;
    const w = findField(text, ["만난 사람", "참석자", "사람", "만난", "people", "참석"]);
    if (w) wEl.value = w;

    /* 일기는 제목이 「날짜 (요일) 누구와 어디」 꼴입니다.
       제목을 고칠 때마다 다시 읽어 채웁니다 —
       「비었을 때만」 채우면 한글을 치는 도중의 「ㄱ」 같은 조각이 굳어 버립니다.
       손으로 고치신 값은 건드리지 않습니다. */
    if (mCat.value === "diary") {
      const g = fromDiaryTitle(document.getElementById("nmT").value);
      if (g.people && (!wEl.value.trim() || wEl.value === autoFill.people)) {
        wEl.value = g.people; autoFill.people = g.people;
      }
      if (g.place && (!pEl.value.trim() || pEl.value === autoFill.place)) {
        pEl.value = g.place; autoFill.place = g.place;
      }
    }
  }
  document.getElementById("nmT").addEventListener("input", autofill);
  document.getElementById("nmB").addEventListener("input", autofill);

  /* ── 글 한 건 저장 ──
     event · event_time · contact 는 auth/event_setup.sql 로 뒤늦게 생긴 칸입니다.
     아직 안 돌리셨으면 그 칸만 빼고 다시 넣어, 글을 통째로 잃지 않게 합니다.
     event 가 event_time 에도 들어 있으므로 긴 이름부터 봅니다. */
  const LATE = ["event_time", "contact", "event"];
  const LATE_NAME = { event_time: "시간", contact: "연락처", event: "행사명" };

  async function putNote(patch, id) {
    const p = { ...patch };
    const dropped = [];
    for (let i = 0; i <= LATE.length; i++) {
      const r = id
        ? await sb.from("notes").update(p).eq("id", id)
        : await sb.from("notes").insert({ ...p, created_by: user.id });
      if (!r.error) return { error: null, dropped };
      const m = r.error.message || "";
      const bad = /column|schema cache/i.test(m)
        ? LATE.find((c) => c in p && m.indexOf(c) >= 0) : null;
      if (!bad) return { error: r.error, dropped };
      delete p[bad];
      dropped.push(bad);
    }
    return { error: null, dropped };
  }

  /* ── 회의록 붙이기 ──
     1.Record/받아쓰기.py 가 만든 txt(글로바꾼것 폴더)를 골라
     그날 Schedule 글에 합칩니다 — 요약은 본문에, 전문 txt 는 붙임으로.
     그날 글이 없으면 새로 만듭니다. 같은 이름이 이미 붙어 있으면 건너뜁니다. */
  document.getElementById("nRec").addEventListener("click", async () => {
    if (typeof window.showDirectoryPicker !== "function") {
      alert("컴퓨터에서 쓰는 기능입니다 — 받아쓰기 도구가 컴퓨터에서 돌기 때문입니다.");
      return;
    }
    let dir;
    try {
      dir = await window.showDirectoryPicker({ id: "skyish-rec", mode: "read" });
    } catch (err) { return; }               // 고르다 닫으신 것

    // txt 를 모읍니다 — 「글로바꾼것」 이 한 겹 안에 있어도 찾아 들어갑니다
    const txts = [];
    const forms = new Map();                 // 「…_회의록.hwpx」 초안들 — 이름으로 찾습니다
    async function walk(d, depth) {
      for await (const e of d.values()) {
        if (e.kind === "file" && /\.txt$/i.test(e.name)) txts.push(await e.getFile());
        else if (e.kind === "file" && /_회의록\.hwpx$/i.test(e.name))
          forms.set(e.name, await e.getFile());
        else if (e.kind === "directory" && depth < 1) await walk(e, depth + 1);
      }
    }
    await walk(dir, 0);
    const jobs = txts
      .map((f) => ({ f, day: findDate(f.name) }))
      .filter((x) => x.day);
    if (!jobs.length) {
      alert("날짜로 시작하는 txt 를 못 찾았습니다." + String.fromCharCode(10) +
        "1.Record 에서 python 받아쓰기.py 를 먼저 돌리고, 「글로바꾼것」 폴더를 골라 주세요.");
      return;
    }
    if (!confirm(`회의록 ${jobs.length}건을 그날 Schedule 글에 붙입니다.` +
      String.fromCharCode(10) + "그날 글이 없으면 새로 만듭니다. 계속할까요?")) return;

    const done = [], skip = [];
    for (const { f, day } of jobs) {
      try {
        const text = await f.text();
        // 본문에는 요약까지만 — 전문은 붙임 txt 로 보면 됩니다
        const cut = text.indexOf("■ 전문");
        const gist = (cut > 0 ? text.slice(0, cut) : text.slice(0, 1500)).trim();

        const row = rows.find((r) =>
          r.category === "schedule" && (r.event_date || "").slice(0, 10) === day);
        if (row && (row.files || []).some((x) => x.name === f.name)) {
          skip.push(f.name + " — 이미 붙어 있습니다"); continue;
        }
        const up = await NF.upload(f);
        const ups = [up];
        // 같은 이름의 회의록 hwpx 초안이 있으면 나란히 붙입니다
        const form = forms.get(f.name.replace(/\.txt$/i, "") + "_회의록.hwpx");
        if (form && !(row && (row.files || []).some((x) => x.name === form.name))) {
          ups.push(await NF.upload(form));
        }
        if (row) {
          const body = mergeBlock(row.body || "", f.name, gist);
          const files = (row.files || []).concat(ups);
          const r2 = await sb.from("notes").update({ body, files }).eq("id", row.id);
          if (r2.error) throw r2.error;
          done.push(day + " → 「" + row.title + "」 에 붙였습니다");
        } else {
          const title = f.name.replace(/\.txt$/i, "");
          const r2 = await sb.from("notes").insert({
            category: "schedule", title,
            body: mergeBlock("", f.name, gist),
            event_date: day, files: ups, created_by: user.id,
          });
          if (r2.error) throw r2.error;
          done.push(day + " → 새 글 「" + title + "」");
        }
      } catch (err) {
        skip.push(f.name + " — " + (err && err.message || "실패"));
      }
    }
    await load();
    alert((done.length ? "붙였습니다:" + String.fromCharCode(10) + done.join(String.fromCharCode(10)) : "") +
      (done.length && skip.length ? String.fromCharCode(10) + String.fromCharCode(10) : "") +
      (skip.length ? "건너뜀:" + String.fromCharCode(10) + skip.join(String.fromCharCode(10)) : ""));
  });

  document.getElementById("nmSave").addEventListener("click", async (e) => {
    const title = document.getElementById("nmT").value.trim();
    if (!title) { msg.textContent = "제목을 적어주세요."; return; }

    /* 구글로 보낼 참인데 아직 안 이어져 있으면, 사람이 누른 「지금」 창을 띄웁니다.
       저장이 다 끝난 뒤에 띄우려 하면 브라우저가 막습니다
       — 게시판에 떴던 「Failed to open popup window」 가 바로 그것입니다. */
    const gcWant = !editing && mCat.value === "schedule" && GC.ready() &&
      !document.getElementById("nmGcalBox").hidden &&
      document.getElementById("nmGcal").checked;
    const gcLink = (gcWant && !GC.connected())
      ? GC.connect().catch((err) => err)      // 창은 여기서 뜨고, 결과는 나중에 봅니다
      : null;
    const body = document.getElementById("nmB").value.trim();
    const dRaw = document.getElementById("nmD").value.trim();
    /* 맛집은 본문에도 한 줄 남깁니다 — 나중에 글만 봐도 알 수 있게.
       이미 있으면 덧붙이지 않고 갈아 끼웁니다. */
    const FOOD_LINE = /^맛집:.*$/m;
    const foodLine = (document.getElementById("nmFood").value || "").trim();
    const NL = String.fromCharCode(10);
    const bodyOut = foodLine
      ? (FOOD_LINE.test(body) ? body.replace(FOOD_LINE, "맛집: " + foodLine)
                              : (body ? body + NL : "") + "맛집: " + foodLine)
      : body.replace(FOOD_LINE, "").trim();

    const patch = {
      category: mCat.value,
      title, body: bodyOut || null,
      event_date: dRaw ? findDate(dRaw) : findDate(title + "\n" + body),
      place:  document.getElementById("nmP").value.trim() || null,
      people: document.getElementById("nmW").value.trim() || null,
      event:  document.getElementById("nmE").value.trim() || null,
      event_time: document.getElementById("nmTm").value.trim() || null,
      contact:    document.getElementById("nmC").value.trim() || null,
      tag:    tagsFor(mCat.value).length ? (mTag.value || null) : null,
    };
    e.target.disabled = true;
    busy = true;
    try {
    // 새로 담은 파일을 먼저 올립니다
    const up = [];
    for (let i = 0; i < picked.length; i++) {
      msg.textContent = "파일 올리는 중… (" + (i + 1) + "/" + picked.length + ")";
      try { up.push(await NF.upload(picked[i])); }
      catch (err) {
        msg.textContent = "파일 올리기 실패: " + friendly(err.message);
        return;
      }
    }
    patch.files = attached.concat(up);
    msg.textContent = "저장하는 중…";

    const r = await putNote(patch, editing && editing.id);
    if (r.error) { msg.textContent = friendly(r.error.message); return; }
    if (r.dropped.length) {
      alert("저장했습니다. 다만 " + r.dropped.map((c) => LATE_NAME[c]).join(" · ") +
            " 칸이 아직 없어 그것만 빠졌습니다." + String.fromCharCode(10) +
            "Supabase SQL Editor 에서 auth/event_setup.sql 을 한 번 돌려 주세요.");
    }
    /* ── 새 일정을 구글 캘린더에도 넣습니다 ──
       고치기가 아니라 새 글일 때만 — 고칠 때마다 넣으면 겹겹이 쌓입니다. */
    if (gcWant && patch.event_date) {
      msg.textContent = "구글 캘린더에 넣는 중…";
      try {
        if (gcLink) {                       // 아까 띄워 둔 창의 결과를 기다립니다
          const got = await gcLink;
          if (got instanceof Error) throw got;
        }
        await GC.addEvent({
          date: patch.event_date,
          time: patch.event_time || "",
          title: (patch.tag ? "[" + patch.tag + "] " : "") + patch.title,
          place: patch.place || "",
        });
      } catch (err) {
        // 구글이 막혀도 글은 이미 저장됐습니다 — 사정만 알립니다
        alert("글은 저장됐지만 구글 캘린더에는 못 넣었습니다." +
          String.fromCharCode(10) + (err && err.message || ""));
      }
    }

    /* ── 맛집을 지도에 올립니다 ──
       비어 있으면 아무것도 하지 않습니다.
       같은 가게가 이미 지도에 있으면 두 번 올리지 않습니다. */
    const foodText = (document.getElementById("nmFood").value || "").trim();
    if (foodText) {
      const list = parseFood(foodText);
      const done = [], same = [], skip = [];
      let needSql = "";
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        msg.textContent = "맛집을 지도에 올리는 중… (" + (i + 1) + "/" + list.length + ") " + f.name;
        if (!f.addr) { skip.push(f.name + " — 주소를 안 적으셨습니다"); continue; }

        // 이미 올라가 있으면 건너뜁니다
        const dup = await sb.from("map_places").select("id").eq("name", f.name).limit(1);
        if (!dup.error && dup.data && dup.data.length) { same.push(f.name); continue; }

        if (i) await new Promise((r) => setTimeout(r, 1100));   // OSM 은 잇달아 물으면 막습니다
        const g = await geoOf(f.addr);
        if (!g) { skip.push(f.name + " — 주소를 못 찾았습니다: " + f.addr); continue; }

        const put = await sb.from("map_places").insert({
          grp: "food", category: f.cat, name: f.name, address: f.addr,
          note: f.catText || null,
          lat: g.lat, lng: g.lng, owner_admin: true, created_by: user.id,
        });
        if (!put.error) { done.push(f.name); continue; }

        const m = put.error.message || "";
        if (/map_places_grp_check|map_places_category_check|violates check/.test(m)) {
          needSql = "지도 표가 아직 「맛집」 갈래를 받아들이지 못합니다." + NL +
                    "Supabase → SQL Editor 에서 auth/map_cats.sql 을 한 번 실행해주세요.";
          skip.push(f.name);
        } else if (/schema cache|does not exist|relation/i.test(m)) {
          needSql = "지도 표가 아직 없습니다 — auth/_ALL_setup.sql 을 한 번 실행해주세요.";
          skip.push(f.name);
        } else if (/row-level security|policy/i.test(m)) {
          needSql = "지도에 올릴 권한이 없습니다 — auth/roles_setup 부분을 실행해주세요.";
          skip.push(f.name);
        } else skip.push(f.name + " — " + m);
      }
      const say = [];
      if (done.length) say.push("지도에 올렸습니다 — " + done.join(", "));
      if (same.length) say.push("이미 지도에 있습니다 — " + same.join(", "));
      if (needSql)     say.push(needSql);
      if (skip.length) say.push("못 올린 것:" + NL + skip.join(NL));
      if (say.length) alert(say.join(NL + NL));
    }

    /* 앱에서 온 길(back=app)이면 저장을 마치고 앱 달력으로 되돌아갑니다.
       시각을 붙여 방금 쓴 일정이 바로 보이게 새로 불러옵니다. */
    if (new URLSearchParams(location.search).get("back") === "app") {
      msg.textContent = "";
      location.href = "app.html?r=" + Date.now();
      return;
    }

    msg.textContent = "";      // 「저장하는 중…」을 지워 둡니다
    close();
    await load();
    } catch (err) {
      /* 무슨 일이 나든 「저장하는 중…」에서 멈추지 않게 합니다.
         까닭을 화면에 그대로 보여 드립니다. */
      msg.textContent = "저장하지 못했습니다 — " + friendly(err && err.message ? err.message : err);
    } finally {
      busy = false;
      e.target.disabled = false;
    }
  });

  document.getElementById("nmDel").addEventListener("click", async () => {
    if (!editing) return;
    if (await removePost(editing)) close();
  });

  /* ── 달력 켜고 끄기 · 엑셀 ── */
  const calBtn = document.getElementById("nCal");
  calBtn.addEventListener("click", async () => {
    calBox.hidden = !calBox.hidden;
    calBtn.classList.toggle("on", !calBox.hidden);
    if (calBox.hidden) { gBox.hidden = true; return; }
    drawCal();
    // 달력을 열면 구글 일정도 함께 얹습니다 (한 번 허락하시면 그다음부터는 조용히)
    if (GC.ready()) await pullGoogle(false, GC.connected());
  });
  /* 구글 일정 — 읽기 권한을 받아 달력에 함께 얹습니다 */
  const gBox = document.getElementById("nGcalBox");
  if (GC.ready() && GC.warm) GC.warm();     // 단추를 누르기 전에 미리 데워 둡니다

  async function pullGoogle(force, quiet) {
    if (!GC.ready()) {
      if (quiet) return;
      gBox.hidden = false;
      gBox.innerHTML = '<p class="ngcal__note">구글 일정을 불러오려면 연결 설정이 한 번 필요합니다. ' +
        '<b>auth/config.js</b> 의 GCAL_CLIENT_ID 를 채워 주세요. ' +
        '만드는 방법은 assets/js/gcal.js 맨 위에 적혀 있습니다.</p>';
      return;
    }
    /* 아직 이어져 있지 않은데 조용히 부르면 구글 창이 열립니다.
       사람이 누른 게 아니라 브라우저가 막고 「Failed to open popup window」가 뜹니다.
       그래서 조용한 호출은 이미 이어져 있을 때만 합니다. */
    if (quiet && !GC.connected()) return;

    const was = calBtn.textContent;
    calBtn.disabled = true;
    calBtn.textContent = "일정 불러오는 중…";
    try {
      if (force) GC.disconnect();
      await GC.connect(force);
      gEvents = await GC.month(calAt.getFullYear(), calAt.getMonth());
      gBox.hidden = false;
      const cals = [...new Set(gEvents.map(function (e) { return e.cal; }).filter(Boolean))];
      gBox.innerHTML = '<p class="ngcal__note">구글 일정 <b>' + gEvents.length +
        '건</b>을 달력에 얹었습니다 (' + calAt.getFullYear() + '년 ' +
        (calAt.getMonth() + 1) + '월' +
        (cals.length ? ' · 캘린더 ' + esc(cals.join(", ")) : "") +
        '). 달을 옮기면 다시 받아 옵니다. ' +
        '<button type="button" class="nlink" id="gAgain">다른 계정으로</button></p>';
      document.getElementById("gAgain").addEventListener("click", () => pullGoogle(true));
      calBox.hidden = false;
      calBtn.classList.add("on");
      drawCal();
    } catch (e) {
      gBox.hidden = false;
      const friendly = /popup/i.test(e.message || "")
        ? "구글 창이 미처 뜨기 전에 브라우저가 막았습니다. 이제 준비해 두었으니 한 번만 다시 눌러 주세요."
        : esc(e.message);
      gBox.innerHTML = '<p class="ngcal__note">' + friendly +
        ' <button type="button" class="nlink" id="gRetry">구글 달력 다시 잇기</button></p>';
      document.getElementById("gRetry").addEventListener("click", () => pullGoogle(false));
    } finally {
      calBtn.disabled = false;
      calBtn.textContent = was;
    }
  }


  /* ── 이미 올라간 글을 한꺼번에 다시 읽기 ──
     붙임 파일이 있는 글을 모두 열어 행사명 · 만난 사람 · 요약을 채웁니다.
     손으로 적어 두신 것은 그대로 두고 빠진 것만 채웁니다. */
  async function fillAll(btn) {
    const todo = rows.filter((r) => Array.isArray(r.files) && r.files.some((f) => {
      const k = NF.kind({ name: f.name || "", type: "" });
      return k === "pdf" || k === "excel" || k === "csv" || k === "text";
    }));
    if (!todo.length) { alert("붙임 파일이 있는 글이 없습니다."); return; }
    if (!confirm(`붙임 파일이 있는 글 ${todo.length}건을 다시 읽습니다.\n` +
                 "손으로 적어 두신 것은 지우지 않습니다. 이어서 할까요?")) return;

    const was = btn.textContent;
    btn.disabled = true;
    let done = 0, failed = 0;

    for (const r of todo) {
      btn.textContent = `⟳ ${++done}/${todo.length}`;
      let body = r.body || "", people = r.people || "", event = r.event || "";
      let changed = false;

      for (const f of r.files) {
        const k = NF.kind({ name: f.name || "", type: "" });
        if (k === "image" || k === "file") continue;
        try {
          const file = await NF.fileFromStore(f);
          const x = await NF.extract(file);
          const t = NF.asText(f.name, x);
          if (t) { const nb = mergeBlock(body, f.name, t); if (nb !== body) { body = nb; changed = true; } }
          if (x.event && !event.trim()) { event = x.event; changed = true; }
          if (x.people && x.people.length) {
            const np = mergePeople(people, x.people);
            if (np !== people) { people = np; changed = true; }
          }
        } catch (err) { failed++; }
      }

      if (!changed) continue;
      const patch = { body: body || null, people: people || null, event: event || null };
      const up = await putNote(patch, r.id);
      if (up.error) failed++;
    }

    btn.disabled = false;
    btn.textContent = was;
    await load();
    alert(`${todo.length}건을 다시 읽었습니다.` + (failed ? `\n${failed}개는 실패했습니다.` : ""));
  }

  const fillBtn = document.getElementById("nFill");
  if (fillBtn) fillBtn.addEventListener("click", (e) => fillAll(e.currentTarget));

  /* ── 0_schedule 폴더에서 일정 글 만들기 ── */
  const folderEl = document.getElementById("nFolder");
  if (folderEl) folderEl.addEventListener("change", async (e) => {
    const list = e.target.files;
    e.target.value = "";                       // 같은 폴더를 다시 골라도 열리게
    if (!list || !list.length) return;
    const NFD = await import("./notes-folder.js?v=202609050500");
    await NFD.openImport(list, {
      user, rows,
      tags: tagsFor("schedule"),
      reload: load,
      save: putNote,
      // 달력이 이어져 있을 때만 맞춰 봅니다 (연결 창은 사람이 눌러서 띄웁니다)
      monthEvents: GC.connected() ? ((y, m0) => GC.month(y, m0)) : null,
    });
  });

  const nXlsBtn = document.getElementById("nXls");
  if (nXlsBtn) nXlsBtn.addEventListener("click", () => {
    const l = shown();
    if (!l.length) { alert("내려받을 글이 없습니다."); return; }
    const t = new Date();
    download(`기록_${cur === "all" ? "전체" : CAT_NAME[cur]}_` +
             `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}.csv`, toCSV(l));
  });

  /* Schedule 갈래에서는 달력이 먼저 보입니다 (아래에 글 목록이 이어집니다) */
  async function autoCal() {
    if (cur !== "schedule" || !calBox.hidden) return;
    calBox.hidden = false;
    calBtn.classList.add("on");
    drawCal();
    if (GC.ready()) await pullGoogle(false, GC.connected());
  }

  /* 첫 화면 달력에서 넘어온 것을 받습니다.
       ?id=…   그 글을 폅니다
       ?new=…  그날로 새 글 창을 폅니다 */
  async function openWanted() {
    const qs = new URLSearchParams(location.search);
    const day = qs.get("new");
    if (day && isAdmin && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      open(null);
      document.getElementById("nmD").value = ymd(day);
      if (mCat.value === "diary") {
        // 일기는 제목이 날짜로 시작합니다
        const t2 = document.getElementById("nmT");
        if (!t2.value.trim()) t2.value = todayTitle(new Date(day + "T00:00:00"));
      }
      const u = new URL(location.href);
      u.searchParams.delete("new");
      history.replaceState(null, "", u.pathname + (u.search || ""));
      return;
    }
    const want = qs.get("id");
    if (!want) return;
    const r = rows.find((x) => String(x.id) === want);
    if (r) {
      detail(r);
      // 주소는 정리해 둡니다 — 새로고침할 때마다 다시 열리면 성가십니다
      const u = new URL(location.href);
      u.searchParams.delete("id");
      history.replaceState(null, "", u.pathname + (u.search || ""));
    }
  }

  q.addEventListener("input", draw);
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); draw(); } });
  document.getElementById("nGo").addEventListener("click", () => { draw(); q.focus(); });
  await load();
  await openWanted();
  await autoCal();
}
