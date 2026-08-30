// ─── BLOG — My Road… (나만 보는 기록) ────────────────────
// Schedule · Diary · 연락망 · 사람들 · 회의록 다섯 갈래.
// 글에 적힌 날짜를 알아채어 달력에 얹고, 엑셀로 내려받을 수 있습니다.
// 관리자만 보고 쓸 수 있습니다 (자료 쪽 규칙 notes_setup.sql 이 실제로 막습니다).
import { sb, currentUser, myProfile } from "../../auth/auth.js";
import * as NF from "./notes-files.js?v=202609010200";
import * as GC from "./gcal.js?v=202609010200";

export const CATS = [
  ["schedule", "Schedule", "#4f9d92"],
  ["diary",    "Diary",    "#c98a3f"],
  ["contacts", "연락망",   "#2a5fa8"],
  ["people",   "사람들",   "#8a6bb0"],
  ["minutes",  "회의록",   "#b3543b"],
  ["daily",    "일상",     "#5c9e4a"],
  ["etc",      "ETC",      "#7d7768"],
];

/** 일반회원에게 열어 주는 갈래 — 「일상」만 봅니다 */
export const MEMBER_CATS = ["daily"];
export const CAT_NAME  = Object.fromEntries(CATS.map(([k, v]) => [k, v]));

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
      '<button type="button" class="nbtn nbtn--go" id="nNew">✎ 새 글</button>' +
    "</div>" +
    '<p class="ncount" id="nCount"></p>' +
    '<div class="ngcal" id="nGcalBox" hidden></div>' +
    '<div class="ncal" id="nCalBox" hidden></div>' +
    '<div class="nlist" id="nList"></div>' +
    '<p class="nempty" id="nEmpty" hidden></p>' +
    '<div class="ndet" id="nDetail"></div>' +
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
  mCat.innerHTML = CATS.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
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

  const match = (r) => {
    const s = q.value.trim().toLowerCase();
    if (!s) return true;
    return ((r.title || "") + " " + (r.body || "") + " " + (r.tag || "") + " " +
            (r.place || "") + " " + (r.people || "") + " " + (r.event || "")).toLowerCase().includes(s);
  };
  // 예전 Diary 글은 Schedule 에 함께 담습니다
  const catOf = (r) => r.category;   // Diary 는 이제 제 갈래로 섭니다
  const shown = () => rows.filter((r) => (cur === "all" || catOf(r) === cur)).filter(match);

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
    countEl.textContent =
      `${cur === "all" ? "전체" : CAT_NAME[cur]} ${l.length}건` +
      (rows.length !== l.length ? ` · 모두 ${rows.length}건` : "");

    // Diary 일 때만 머리그림을 폅니다. 그때는 위 머리 칸을 접어 자리를 내줍니다.
    const dbg = document.getElementById("nDiaryBg");
    const isDiary = (cur === "diary");
    if (dbg) dbg.hidden = !isDiary;
    document.body.classList.toggle("diary-on", isDiary);

    if (!calBox.hidden) drawCal();

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
      cells += `<div class="ccell${out ? " out" : ""}${key === todayIso ? " today" : ""}">` +
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

  /* ── 글 쓰기·고치기 ── */
  function open(row) {
    editing = row || null;
    dirty = false;                       // 새로 여는 것이므로 고친 것이 없습니다
    document.getElementById("nDetail").classList.remove("on");   // 위에 덮인 창을 걷습니다
    document.getElementById("nmTitle").textContent = row ? "글 고치기" : "새 글";
    document.getElementById("nmDel").hidden = !row;
    mCat.value = row ? row.category : (cur === "all" ? "schedule" : cur);
    document.getElementById("nmT").value = row ? row.title || "" : "";
    document.getElementById("nmB").value = row ? row.body || "" : "";
    document.getElementById("nmE").value = row ? row.event || "" : "";
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
       본문에 「장소:」 「사람:」 을 따로 안 적으셨을 때만 제목에서 읽어냅니다. */
    if (mCat.value === "diary") {
      const g = fromDiaryTitle(document.getElementById("nmT").value);
      if (g.people && !wEl.value.trim()) wEl.value = g.people;
      if (g.place && !pEl.value.trim()) pEl.value = g.place;
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

  document.getElementById("nmSave").addEventListener("click", async (e) => {
    const title = document.getElementById("nmT").value.trim();
    if (!title) { msg.textContent = "제목을 적어주세요."; return; }
    const body = document.getElementById("nmB").value.trim();
    const dRaw = document.getElementById("nmD").value.trim();
    const patch = {
      category: mCat.value,
      title, body: body || null,
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
      gBox.innerHTML = '<p class="ngcal__note">' + esc(e.message) + "</p>";
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
    const NFD = await import("./notes-folder.js?v=202609010200");
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
