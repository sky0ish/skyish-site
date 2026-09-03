// ─── 개최개요·프로그램 읽기 ─────────────────────────────────
//
//  심포지엄 안내문이나 자문회의 개최건의를 붙이면, 거기서
//  행사명 · 날짜 · 시각 · 장소 · 만난 사람을 뽑아 칸에 채웁니다.
//
//  두 가지 꼴을 다 읽습니다.
//
//   ① 개최개요 꼴 — 이름표가 붙은 줄
//        사 업 명 : 2026년 경기도 방산클러스터 운영
//        개최일시 : 2026년 9월 2일(화) 14:00~17:00
//        장    소 : 경기연구원 대회의실
//        외부참여진(3인) : 이석준(이천시청), 강한구(국방연구원)
//
//   ② 프로그램 꼴 — 시각과 배역이 줄마다 붙은 것
//        14:00  개회사      김지사 (경기도지사)
//        14:20  기조발표    남지현 (경기연구원)
//        15:00  좌장: 홍길동 교수 / 토론: 김영희, 박민수
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험할 수 있습니다
//  (tools/test/brief.mjs).
import { justName } from "./notes-stats.js?v=202609010300";

/* ── 이름 가려내기 ───────────────────────────────────────── */

/** 사람 이름이 아닌, 이 자리에 흔히 나오는 말들 */
const NOT_NAME = new Set([
  "개회", "폐회", "환영", "축사", "인사", "기조", "발표", "토론", "질의", "응답",
  "사회", "좌장", "진행", "휴식", "중식", "석식", "오찬", "만찬", "등록", "접수",
  "개최", "일시", "장소", "주최", "주관", "후원", "참석", "대상", "내용", "안건",
  "사업", "과제", "제목", "목적", "배경", "결과", "보고", "회의", "자문", "세미나",
  "포럼", "심포", "학술", "대회", "위원", "교수", "박사", "대표", "이사", "부장",
  "실장", "국장", "센터", "본부", "연구", "정책", "기획", "총괄", "패널", "종합",
  "우리", "여러", "관련", "각각", "이상", "이하", "당일", "현장", "온라인",
  // 「개회사」 처럼 -사 로 끝나는 배역도 이름이 아닙니다
  "개회사", "폐회사", "환영사", "인사말", "기조연설", "기조강연",
  "발표자", "토론자", "사회자", "진행자", "참석자", "참가자", "참여자",
  "질의응답", "종합토론", "자유토론", "특별강연", "초청강연",
]);

const ORG_TAIL = /(연구원|연구소|대학교|대학|학교|시청|군청|도청|구청|공사|공단|재단|협회|학회|센터|본부|위원회|주식회사|아카데미|진흥원|공단|청$|부$)/;

/** 이 낱말이 사람 이름으로 보이는가 */
export function looksLikeName(w) {
  const t = String(w || "").trim();
  if (!/^[가-힣]{2,4}$/.test(t)) return false;
  if (NOT_NAME.has(t)) return false;
  if (ORG_TAIL.test(t)) return false;
  return true;
}

/* 「이석준(이천시청)」 · 「남지현 경기연구원 선임연구위원」 · 「홍길동 교수」 */
/* 앞에 한글이 더 붙어 있으면 긴 낱말을 잘라 온 것입니다
   (「외부참여진(3인)」 에서 「부참여진」 을 뽑던 일을 막습니다).
   뒤돌아보기(lookbehind)는 옛 브라우저에서 막히므로 앞 글자를 함께 잡습니다. */
const NAME_PAREN = /(^|[^가-힣])([가-힣]{2,4})\s*[(（]\s*([^)）]{1,24})\s*[)）]/g;
const NAME_TITLE = /(^|[^가-힣])([가-힣]{2,4})\s+((?:[가-힣A-Za-z·]+\s*){0,2}(?:교수|박사|위원|위원장|연구위원|연구원|대표|이사|사장|본부장|센터장|실장|국장|과장|팀장|부장|차장|주무관|사무관|담당관|의원|시장|군수|지사|장관|차관|총장|학장|선임연구위원))/g;
/* 「(3인)」 「(2명)」 처럼 사람 수만 적힌 괄호는 소속이 아닙니다 */
const JUST_COUNT = /^\s*\d+\s*(인|명)\s*$/;

/** 줄에서 사람을 뽑습니다 → ["이석준 (이천시청)", "남지현 경기연구원 …"] */
export function peopleIn(line) {
  const t = String(line || "");
  const out = [];
  const seen = new Set();
  const put = (name, tail) => {
    if (!looksLikeName(name)) return;
    if (seen.has(name)) return;
    seen.add(name);
    out.push(tail ? name + " (" + String(tail).trim() + ")" : name);
  };

  /* 앞의 낱말이 배역이면(「좌장 홍길동 교수」의 「좌장」) 그 자리에서 멈추지 않고
     한 글자만 건너뛰어 다시 찾습니다. 안 그러면 정규식이 배역을 이름으로 먹고
     뒤의 진짜 이름까지 통째로 삼켜 버립니다. */
  const scan = (re, ok) => {
    re.lastIndex = 0;
    let x;
    while ((x = re.exec(t))) {
      if (ok(x)) put(x[2], x[3]);
      else re.lastIndex = x.index + x[1].length + 1;   // 늘 앞으로 갑니다
    }
  };
  scan(NAME_PAREN, (x) => looksLikeName(x[2]) && !JUST_COUNT.test(x[3]));
  scan(NAME_TITLE, (x) => looksLikeName(x[2]));

  /* 「좌장: 홍길동 교수 / 토론: 김영희, 박민수」 —
     빗금·쌍반점으로 먼저 토막을 낸 뒤, 토막마다 배역 뒤의 이름을 봅니다.
     한 줄에 배역이 둘이면 앞의 것만 보고 뒤를 놓치던 일을 막습니다. */
  const ROLE_HEAD = /(?:좌장|사회|진행|발표|토론|패널|참석자?|참여|외부참여진)[^:：]*[:：]\s*(.+)$/;
  t.split(/\s*[/;|｜]\s*/).forEach((seg) => {
    const role = String(seg).match(ROLE_HEAD);
    if (!role) return;
    role[1].split(/\s*[,·、]\s*|\s{2,}/).forEach((p) => {
      const w = p.trim().replace(/^[^가-힣A-Za-z]+/, "").split(/\s+/)[0];
      put(w, "");
    });
  });
  return out;
}

/* ── 날짜·시각·장소 ──────────────────────────────────────── */

const pad = (n) => String(n).padStart(2, "0");

/** 「2026년 9월 2일」 · 「2026.09.02」 · 「2026-9-2」 → 2026-09-02 */
export function findDate(text) {
  const t = String(text || "");
  let m = t.match(/(20\d\d)\s*[.\-년/]\s*(\d{1,2})\s*[.\-월/]\s*(\d{1,2})/);
  if (m) return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);
  m = t.match(/(20\d\d)(\d{2})(\d{2})/);          // 20260902
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  return "";
}

/** 첫 시각 「14:00」 (오후 2시 꼴도 봅니다) */
export function findTime(text) {
  const t = String(text || "");
  const m = t.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (m) {
    const h = +m[1];
    if (h <= 23 && +m[2] <= 59) return pad(h) + ":" + m[2];
  }
  const k = t.match(/(오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (k) {
    let h = +k[2];
    if (k[1] === "오후" && h < 12) h += 12;
    if (k[1] === "오전" && h === 12) h = 0;
    return pad(h) + ":" + pad(k[3] ? +k[3] : 0);
  }
  return "";
}

const LABEL = (names) =>
  new RegExp("(?:^|\\s)(?:" + names + ")\\s*[:：]?\\s*(.+)$");

const P_PLACE = LABEL("장\\s*소|개최장소|회의장소|행사장소");
const P_WHEN  = LABEL("개최일시|행사일시|일\\s*시|일\\s*정|날\\s*짜");
const P_EVENT = LABEL("사\\s*업\\s*명|행\\s*사\\s*명|회의명|과제명|제\\s*목|주\\s*제|회의내용|안\\s*건");
const P_WHO   = LABEL("외부참여진|참석대상|참석자|참\\s*석|참여자|참가자");

/** 이름표가 붙은 줄에서 값만 꺼냅니다 */
function labelled(lines, re, max) {
  for (const raw of lines) {
    const m = String(raw || "").match(re);
    if (!m) continue;
    let v = m[1].replace(/\s+/g, " ").trim().replace(/^[·:：\-]\s*/, "");
    v = v.replace(/\s*\(\s*\)\s*/g, " ").trim();
    if (v && (!max || v.length <= max)) return v;
  }
  return "";
}

/* 배역이 적힌 줄 — 여기 있는 이름은 그 자리에서 만난 사람입니다 */
const ROLE = /(좌장|사회|진행|기조|발표|토론|패널|축사|환영사|개회사|인사말|강연|참석|참여|외부참여진)/;

/**
 * 안내문에서 칸에 채울 것을 뽑습니다.
 * @param lines  줄 목록 (PDF·엑셀·글·OCR 어느 쪽에서 왔든)
 * @returns { event, date, time, place, people:[] }
 */
export function readBrief(lines) {
  const L = (Array.isArray(lines) ? lines : String(lines || "").split(/\r?\n/))
    .map((x) => String(x == null ? "" : x).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const all = L.join("\n");

  const whenLine = labelled(L, P_WHEN, 120);
  const event = labelled(L, P_EVENT, 120);
  const place = labelled(L, P_PLACE, 60);

  /* 날짜 — 일시 줄을 먼저 보고, 없으면 글 전체에서 */
  const date = findDate(whenLine) || findDate(all);
  /* 시각 — 일시 줄 → 프로그램의 첫 시각 */
  const time = findTime(whenLine) ||
    findTime((L.find((x) => ROLE.test(x) && /\d{1,2}\s*[:：]\s*\d{2}/.test(x)) || ""));

  /* 사람 — 참석자 줄과 배역이 적힌 줄에서 */
  const people = [];
  const seen = new Set();
  const add = (list) => list.forEach((p) => {
    const k = justName(p);
    if (!k || seen.has(k)) return;
    seen.add(k); people.push(p);
  });

  const whoLine = labelled(L, P_WHO, 300);
  if (whoLine) add(peopleIn(whoLine));
  L.forEach((x) => { if (ROLE.test(x)) add(peopleIn(x)); });

  return { event, date, time, place, people };
}
