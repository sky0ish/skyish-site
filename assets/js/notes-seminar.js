// ─── 세미나·토론회 행사 정보(개최계획·안내문) → 개요 ─────────────
//
//  「세미나에 info 가 있으면 참석자 명단을 자동으로 인식해서 캘린더를 보정해서 올려줘.
//    참여자·주제 등 개요를 게시판에 올려줘. 만난 사람도 넣어 주고.」
//
//  행사 폴더의 info/ (개최계획 PDF · 안내문 그림을 글자로 읽은 것) 에서
//    주제 · 일시(날짜·시각) · 장소 · 주최/주관 · 사회 · 좌장 · 발제자 · 토론자 · 참석자 · 프로그램
//  을 뽑아, 그날 Schedule 글의 시각·장소·행사명·만난 사람·본문(개요)을 채웁니다.
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험합니다 (tools/test/seminar.mjs).
//  글자 읽기(PDF·OCR)는 notes-files.js 가, 글 저장·구글 달력은 notes.js 가 맡습니다.

const NL = String.fromCharCode(10);

/* ── 글자 다듬기 ───────────────────────────────────────────── */

/** 「일 시」 「장    소」 처럼 글자 사이가 벌어진 표제어도 잡히게 — 한 글자씩 \s* 를 끼웁니다 */
const loose = (word) => word.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s*");
const LBL = (words) => "(?:" + words.map(loose).join("|") + ")";
/* 줄머리 기호 — ㅇ ○ ● ■ □ ▪ ◦ ・ • - ※ 가. 나. 1) ① */
const BULLET = "(?:[ㅇ○●■□▪◦・•\\-–—※*]|[가-힣]\\.|\\d+\\)|[①-⑳])?\\s*";
const SEP = "\\s*[:：]\\s*";

const L_TOPIC = LBL(["주제", "제목", "행사명", "세미나명", "토론회명", "회의명", "포럼명"]);
const L_WHEN = LBL(["일시", "일정", "날짜", "개최일시", "개최일"]);
const L_WHERE = LBL(["장소", "개최장소", "회의장소"]);
const L_HOST = LBL(["주최"]);
const L_ORG = LBL(["주관"]);
const L_HOSTORG = LBL(["주최/주관", "주최·주관", "주최ㆍ주관", "주최 및 주관"]);
const L_MC = LBL(["사회", "진행"]);
const L_CHAIR = LBL(["좌장", "사회자 및 좌장"]);
const L_PRES = LBL(["발제자", "발표자", "발제", "발표", "기조발제", "기조발표", "기조강연", "강연자", "연사"]);
const L_DISC = LBL(["토론자", "지정토론자", "지정토론", "토론", "패널", "패널토론"]);
const L_ATT = LBL(["참석자", "참석", "참가자", "참여자", "참석대상"]);

/** 직함 — 이름 뒤에 붙는 것들 (긴 것부터) */
const TITLES = [
  "선임연구위원", "책임연구위원", "부연구위원", "수석연구원", "주임연구원", "전임연구원", "선임연구원", "책임연구원", "연구위원", "연구원",
  "전문위원", "위원장", "위원", "명예교수", "부교수", "조교수", "교수", "박사", "석사",
  "총장", "부총장", "학장", "원장", "부원장", "소장", "센터장", "실장", "본부장", "단장", "부장", "차장", "과장", "팀장", "국장", "처장", "국회의원", "의원",
  "대표이사", "대표", "사장", "부사장", "회장", "부회장", "이사장", "이사", "상무", "전무", "감사", "변호사", "회계사", "기자", "PD", "감독",
  "시장", "군수", "구청장", "도지사", "지사", "장관", "차관", "주무관", "사무관", "서기관", "담당관", "정책관", "관장", "협회장", "학회장",
];
const TITLE_RE = "(?:" + TITLES.join("|") + ")";
/** 이름(한글 2~4자) + 직함 — 「이현주 연구위원」 「김두환연구위원」 */
const NAME_TITLE = new RegExp("([가-힣]{2,4})\\s*(" + TITLE_RE + ")(?![가-힣])", "g");
/** 이름 + (소속) — 「김현호 원장(前 고양연구원)」 「이승은 주임연구원(LH 토지주택연구원)」 */
const ORG_TAIL = /(연구원|연구소|연구실|연구센터|센터|대학교|대학|대학원|학교|시청|군청|도청|구청|공사|공단|재단|협회|학회|본부|위원회|진흥원|개발원|사업단|조합|법인|주식회사|회사|기업|은행|의원실|국회|정부|부|처|청|원|국|과|실|팀)$/;
const NOT_NAME = /^(발제|발표|토론|사회|좌장|참석|주제|일시|장소|주최|주관|개회|폐회|종합|지정|기조|세미나|토론회|포럼|워크숍|워크샵|프로그램|비고|시간|내용|참가|안내|접수|등록|휴식|중식|석식|점심|저녁|오전|오후|국토|주택|도시|지역|경기|서울|한국|남북|평화|경제|산업|전략|정책|현황|과제|방향|방안|연구|개발|계획|사업|추진|공간|탐색|개성|공단|재개|여건|단계|준비|협력|실행|전망|공동|공존|과제와|전반|후반|이하|이상|각각|모두)$/;

/** 「[발제1] 제목 (이름 직함, 소속)」 「[발제2] 제목」 줄 다음 「(이름 직함, 소속)」 */
const BRACKET = /\[\s*((?:기조)?(?:발제|발표|강연|토론|세션)\s*\d*)\s*\]\s*(.*)/;
/** 「1주제: 매입임대 주택 현황 진단과 전망 - 이강훈 (변호사)」 — 포스터의 주제발표 줄 */
const TOPIC_LINE = /^\s*(?:제\s*)?(\d+)\s*주제\s*[:：]\s*(.+)$/;

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const strip = (s) => clean(s).replace(/^[ㅇ○●■□▪◦・•\-–—※*]\s*/, "");

/* ── 사람 뽑기 ─────────────────────────────────────────────── */

/** 한 줄에서 사람들 — [{name, title, org}]
 *  「이현주 연구위원, 국토연구원」 「김두환 연구위원(LHRI)」 「박기태 차장(LH 글로벌사업처)」
 *  「김현호 원장(前, 고양연구원), 남지현 센터장(경기연구원)」 */
export function peopleInLine(line) {
  const out = [];
  const s = clean(line);
  if (!s) return out;

  /* 괄호마다 살펴봅니다 —
       ① 안에 「이름 직함」이 또렷이(괄호 첫머리나 쉼표 뒤에) 있으면 그 괄호가 **사람**을 담은 것
          「[발제1] 평화경제특구의 과제와 전망 (이현주 연구위원, 국토연구원)」
       ② 아니면 앞에 적힌 이름의 **소속·직함**을 적은 것
          「남지현 (경기연구원 균형발전지원센터장)」 — 여기서 「전지원 센터장」 같은 헛이름이 나오지 않게 합니다 */
  const parens = [];
  const PAREN_RE = /[(（][^()（）]*[)）]/g;
  let pm;
  while ((pm = PAREN_RE.exec(s))) {
    parens.push({ a: pm.index, b: pm.index + pm[0].length, inner: pm[0].slice(1, -1) });
  }
  /* 괄호 안에 또렷한 「이름 직함」이 있는가 — 첫머리이거나 앞이 한글이 아닐 때만 또렷한 것으로 봅니다 */
  const clearIn = (txt) => {
    const re = new RegExp("([가-힣]{2,4})\\s*(" + TITLE_RE + ")(?![가-힣])", "g");
    let m2;
    while ((m2 = re.exec(txt))) {
      if (NOT_NAME.test(m2[1]) || isTitleWord(m2[1]) || isTitleWord(m2[1] + m2[2])) continue;   // 「선임연구+위원」 은 직함 한 낱말
      const before = m2.index === 0 || !/[가-힣]/.test(txt[m2.index - 1]);
      const after = /^\s*(?:[,，]|$)/.test(txt.slice(m2.index + m2[0].length));
      if (before && after) return true;   // 「이현주 연구위원, 국토연구원」 · 「토지주택연구원 선임연구위원」 은 아님
    }
    return false;
  };
  parens.forEach((x) => { x.person = clearIn(x.inner); });
  const inParen = (i) => parens.find((x) => i > x.a && i < x.b) || null;

  /* ① 「이름 직함」 — 「이현주 연구위원」 「김두환연구위원」 */
  NAME_TITLE.lastIndex = 0;
  let m;
  while ((m = NAME_TITLE.exec(s))) {
    let name = m[1];
    const title = m[2];
    const pr = inParen(m.index);
    if (pr) {
      if (!pr.person) continue;          // 소속·직함을 적은 괄호 — 여기엔 사람 이름이 없습니다
      /* 사람을 담은 괄호라도 또렷한 자리(첫머리·쉼표 뒤)일 때만 */
      if (m.index !== pr.a + 1 && /[가-힣]/.test(s[m.index - 1])) continue;
    } else if (name.length === 4 && m.index > 0 && /[가-힣]/.test(s[m.index - 1])) {
      /* 「과제김두환연구위원」 처럼 앞에 다른 글자가 붙어 경계가 흐리면 — 이름은 대개 석 자 */
      name = name.slice(-3);
    }
    if (NOT_NAME.test(name) || isTitleWord(name) || isTitleWord(name + title)) continue;
    /* 뒤에 붙은 (소속) 또는 「, 소속」 — 소속 안의 「고양연구원」 이 또 사람으로 잡히지 않게 건너뜁니다 */
    let org = "";
    const rest = s.slice(m.index + m[0].length);
    const paren = rest.match(/^\s*[(（]\s*([^()（）]{1,60})\s*[)）]/);
    if (paren) { org = clean(paren[1]).replace(/^(前|전|現|현)\s*,?\s*/, "$1 "); NAME_TITLE.lastIndex = m.index + m[0].length + paren[0].length; }
    else {
      const comma = rest.match(/^\s*,\s*([^,()（）\[\]]{2,40}?)(?=\s*[,)）\]]|\s*$|\s{2,}|\s*\[)/);
      if (comma && ORG_TAIL.test(clean(comma[1]).replace(/^(前|전|現|현)\s*/, ""))) {
        org = clean(comma[1]); NAME_TITLE.lastIndex = m.index + m[0].length + comma[0].length;   // 「, LH 토지주택연구원」 도 건너뜁니다
      }
    }
    if (!out.some((q) => q.name === name)) out.push({ name, title, org });
  }

  /* ② 「이름 (소속 직함)」 — 행사 포스터가 즐겨 쓰는 꼴.
     「김선주 (경기대학교 부동산자산관리학과 주임교수)」 「이강훈 (변호사)」 */
  parens.filter((x) => !x.person).forEach((x) => {
    const before = s.slice(0, x.a).match(/([가-힣]{2,4})\s*$/);
    if (!before) return;
    const name = before[1];
    const at = x.a - before[0].length;                   // 이름이 시작하는 자리
    if (at > 0 && /[가-힣]/.test(s[at - 1])) return;      // 「…추진전략박기태차장(…)」 처럼 붙어 있으면 이름이 아닙니다
    const inside = clean(x.inner);
    if (NOT_NAME.test(name)) return;
    if (new RegExp("^" + TITLE_RE + "$").test(name)) return;     // 「이미홍 실장(LHRI)」 의 「실장」
    if (/^\d/.test(inside)) return;                              // 「(2,460호)」 같은 숫자 괄호
    const ti = titleIn(inside);
    if (!ti && !ORG_TAIL.test(inside)) return;                   // 직함도 소속도 아니면 사람이 아닙니다
    if (out.some((q) => q.name === name)) return;
    /* 소속은 괄호 글에서 직함을 뗀 나머지 — 「경기대학교 부동산자산관리학과 주임교수」 → 「경기대학교 부동산자산관리학과」 */
    const org = ti
      ? clean(inside.replace(new RegExp("\\s*(?:주임|수석|책임|선임|전임|겸임|초빙|객원|특임|상임|부|정|조)?\\s*" + ti + "\\s*$"), ""))
      : inside;
    out.push({ name: name, title: ti, org: org || inside });
  });
  /* 글에 적힌 차례대로 */
  out.sort((a, b2) => s.indexOf(a.name) - s.indexOf(b2.name));
  return out;
}

/** 「이름 (소속 직함)」 — 「김선주 (경기대학교 부동산자산관리학과 주임교수)」 「이강훈 (변호사)」
    괄호 안에 직함이나 소속 꼬리가 있을 때만 사람으로 봅니다 (「매입임대(2,460호)」 같은 것을 거르려고). */
const NAME_PAREN = new RegExp("(^|[^가-힣])([가-힣]{2,4})\\s*[(（]\\s*([^()（）]{2,60}?)\\s*[)）]", "g");

/** 괄호 안 글에서 직함 하나 — 끝에 붙은 것을 먼저 봅니다 (「경기연구원 균형발전지원센터장」 → 센터장) */
function titleIn(org) {
  const t = String(org || "");
  const tail = t.match(new RegExp("(?:주임|수석|책임|선임|전임|겸임|초빙|객원|특임|상임)?\s*" + TITLE_RE + "\s*$"));
  if (tail) return clean(tail[0]).replace(/^(?:주임|수석|책임|선임|전임|겸임|초빙|객원|특임|상임)\s*/, "");
  const m = t.match(new RegExp(TITLE_RE + "(?![가-힣])"));
  return m ? m[0] : "";
}

/** 이 낱말이 직함인가 — 「주임」 「수석」 처럼 이름 자리에 와도 사람이 아닙니다 */
const isTitleWord = (n) => new RegExp("^(?:주임|수석|책임|선임|전임|겸임|초빙|객원|특임|상임)$|^(?:주임|수석|책임|선임|전임|겸임|초빙|객원|특임|상임)?(?:" + TITLE_RE + ")$").test(String(n || ""));

/** 여러 줄에서 — 같은 이름은 한 번만, 먼저 나온 차례대로 */
export function peopleInLines(lines) {
  const out = [], seen = new Set();
  (lines || []).forEach((ln) => peopleInLine(ln).forEach((p) => {
    if (seen.has(p.name)) return;
    seen.add(p.name); out.push(p);
  }));
  return out;
}

/** 「이름 직함(소속)」 한 덩이 — 만난 사람 칸에 적는 꼴. 소속이 있으면 「이름 (소속)」 */
export const personLabel = (p) => p.org ? p.name + " (" + p.org + ")" : p.name;

/* ── 날짜·시각 ─────────────────────────────────────────────── */

/** 「’26.09.17(목)」 「2026년 9월 17일(목)」 「26.9.17」 → "2026-09-17" */
export function dateIn(text, fallbackYear) {
  const s = String(text || "");
  let m = s.match(/(?:['’‘]\s*)?(\d{2,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/);
  if (!m) {
    /* 「9월 17일」 만 있으면 해는 폴더에서 */
    const m2 = s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (!m2 || !fallbackYear) return "";
    return fallbackYear + "-" + m2[1].padStart(2, "0") + "-" + m2[2].padStart(2, "0");
  }
  let y = +m[1]; if (y < 100) y += 2000;
  const mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}

/** 「13:30~15:30」 「14:00 ~ 16:00」 「오후 2시」 「14시 30분」 → { time:"13:30", end:"15:30" } */
export function timeIn(text) {
  const s = String(text || "");
  const t = (h, mi, pm) => {
    let hh = +h; const mm = mi ? +mi : 0;
    if (pm && hh < 12) hh += 12;
    if (hh > 23 || mm > 59) return "";
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  };
  let m = s.match(/(\d{1,2})\s*[:：]\s*(\d{2})\s*[~∼～\-–—]\s*(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (m) return { time: t(m[1], m[2]), end: t(m[3], m[4]) };
  m = s.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (m) return { time: t(m[1], m[2]), end: "" };
  m = s.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/);
  if (m) return { time: t(m[2], m[3], m[1] === "오후"), end: "" };
  return { time: "", end: "" };
}

/* ── 개요 뽑기 ─────────────────────────────────────────────── */

/** 표제어로 시작하는 줄이면 그 값 (여러 줄에 걸치면 뒤 줄은 부르는 쪽이 이어 붙입니다) */
function labeled(line, LABEL) {
  const t = clean(line);
  const m = t.match(new RegExp("^\\s*" + BULLET + LABEL + SEP + "(.*)$"));
  if (m) return clean(m[1]);
  /* 「:」 없이 띄어쓰기로만 나눈 꼴 — 행사 포스터에 흔합니다 (일 시 … · 장 소 …) */
  const m2 = t.match(new RegExp("^\\s*" + BULLET + LABEL + "\\s+(\\S.*)$"));
  return m2 ? clean(m2[1]) : null;
}
/** 표제어만 있고 값이 다음 줄에 오는가 (「토론자 :」 로 끝나는 줄) */
function labelOnly(line, LABEL) {
  return new RegExp("^\\s*" + BULLET + LABEL + "\\s*[:：]?\\s*$").test(clean(line));
}

/**
 * 행사 정보 글에서 개요를 뽑습니다.
 * @param text   PDF·OCR 에서 뽑은 글 (줄바꿈으로 나뉜 것)
 * @param info   폴더 정보 { date:"2026-09-17", kind:"토론", rest:"LH_" } (notes-workshop.parseFolder)
 * @returns {title, date, time, end, place, host, organizer, mc:[…], chair:[…],
 *           presenters:[{name,title,org,topic}], discussants:[…], attendees:[…], program:[{time,what,who}], src}
 */
export function parseBrief(text, info) {
  const lines = String(text || "").replace(/\r/g, "").split(NL).map((x) => x.replace(/ /g, " ")).filter((x) => x.trim());
  const b = { title: "", date: "", time: "", end: "", place: "", host: "", organizer: "",
              mc: [], chair: [], presenters: [], discussants: [], attendees: [], program: [], src: "" };
  const year = info && info.date ? info.date.slice(0, 4) : "";
  let mode = "";                                   // 지금 이어지는 항목 (발제자·토론자·참석자)
  const bucket = { pres: [], disc: [], att: [] };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    let v;
    if ((v = labeled(ln, L_HOSTORG)) != null) {
      const parts = v.split(/\s*[/／]\s*/); b.host = b.host || parts[0] || ""; b.organizer = b.organizer || parts.slice(1).join(" / "); mode = ""; continue;
    }
    if ((v = labeled(ln, L_TOPIC)) != null) { if (!b.title) b.title = v.replace(/^([‘'"「『])(.*)[’'"」』]$/, "$2"); mode = ""; continue; }
    if ((v = labeled(ln, L_WHEN)) != null) {
      if (!b.date) b.date = dateIn(v, year);
      const tm = timeIn(v); if (!b.time && tm.time) { b.time = tm.time; b.end = tm.end; }
      mode = ""; continue;
    }
    if ((v = labeled(ln, L_WHERE)) != null) { if (!b.place) b.place = v; mode = ""; continue; }
    if ((v = labeled(ln, L_HOST)) != null) {
      const parts = v.split(/\s*[/／]\s*/); if (!b.host) b.host = parts[0]; if (parts[1] && !b.organizer) b.organizer = parts[1]; mode = ""; continue;
    }
    if ((v = labeled(ln, L_ORG)) != null) { if (!b.organizer) b.organizer = v; mode = ""; continue; }
    if ((v = labeled(ln, L_CHAIR)) != null) { b.chair = b.chair.concat(peopleInLine(v)); mode = ""; continue; }
    if ((v = labeled(ln, L_MC)) != null) { b.mc = b.mc.concat(peopleInLine(v)); mode = ""; continue; }
    if ((v = labeled(ln, L_PRES)) != null || labelOnly(ln, L_PRES)) { mode = "pres"; if (v) bucket.pres.push(v); continue; }
    if ((v = labeled(ln, L_DISC)) != null || labelOnly(ln, L_DISC)) { mode = "disc"; if (v) bucket.disc.push(v); continue; }
    if ((v = labeled(ln, L_ATT)) != null || labelOnly(ln, L_ATT)) { mode = "att"; if (v) bucket.att.push(v); continue; }
    /* 「1주제: 매입임대 주택 현황 진단과 전망 - 이강훈 (변호사)」 — 포스터의 주제발표 줄 */
    const tm0 = clean(ln).match(TOPIC_LINE);
    if (tm0 && peopleInLine(tm0[2]).length) { bucket.pres.push("[발제" + tm0[1] + "] " + clean(tm0[2])); mode = ""; continue; }
    /* 프로그램 표 — 「13:30 - 13:40 개회, 참석자소개 사회: 이승은 주임연구원」 */
    const pm = clean(ln).match(/^(\d{1,2}\s*[:：]\s*\d{2})\s*[~∼～\-–—]\s*(\d{1,2}\s*[:：]\s*\d{2})?\s*(.*)$/);
    if (pm && pm[3]) {
      const what = clean(pm[3]);
      const who = peopleInLine(what);
      b.program.push({ time: pm[1].replace(/\s/g, "") + (pm[2] ? "~" + pm[2].replace(/\s/g, "") : ""), what, who });
      /* 표 안의 [발제] 줄도 발제자로, 「토론」 줄의 사람도 토론자로 */
      if (/발제|발표|강연/.test(what) && who.length) bucket.pres.push(what);
      else if (/토론/.test(what) && who.length) bucket.disc.push(what);
      else if (/좌장/.test(what) && who.length) b.chair = b.chair.concat(who);
      else if (/사회/.test(what) && who.length) b.mc = b.mc.concat(who);
      mode = ""; continue;
    }
    /* 이어지는 줄 — 「[발제2] …」 「(이현주 연구위원, 국토연구원)」 「김민아 부연구위원(국토연구원), …」 */
    if (mode && (BRACKET.test(ln) || /[가-힣]{2,4}\s*(?:교수|박사|위원|원장|실장|센터장|차장|연구원|대표|의원)/.test(ln) || /^\s*[(（]/.test(ln))) {
      bucket[mode].push(clean(ln)); continue;
    }
    /* 「※ 발표 제목은 …」 같은 안내나 다른 항목이 오면 이어 붙이기를 끝냅니다 */
    if (mode && /^\s*(※|◇|■|□|나\.|다\.|라\.|\d+\.\s)/.test(ln)) mode = "";
    /* 「일 시 · 장 소」 를 못 잡았어도 글 어딘가의 날짜·시각 */
    if (!b.date) { const d = dateIn(ln, ""); if (d) b.date = d; }
  }

  /* 발제 — [발제1] 제목 (이름 직함, 소속) 짝 맞추기. 제목 줄과 사람 줄이 나뉘어 있으면 이어 붙입니다 */
  const joinedPres = [];
  bucket.pres.forEach((s) => {
    const m = s.match(BRACKET);
    if (m || !joinedPres.length) joinedPres.push(s);
    else joinedPres[joinedPres.length - 1] += " " + s;
  });
  joinedPres.forEach((s) => {
    const m = s.match(BRACKET);
    const body = m ? m[2] : s;
    const who = peopleInLine(body);
    let topic = body.replace(/[(（][^()（）]*[)）]\s*$/, "");   // 끝의 (이름 …) 를 뗍니다
    who.forEach((p) => {
      topic = topic.replace(new RegExp(p.name + "\\s*" + p.title + ".*$"), "");
      topic = topic.replace(new RegExp("\\s*[-\u2013\u2014]\\s*" + p.name + "\\s*$"), "");   // 「제목 - 이강훈」 의 꼬리
    });
    topic = clean(topic).replace(/[,，(（]\s*$/, "").trim();   // 이름을 뗀 뒤 남은 여는 괄호도
    if (!who.length && !topic) return;
    if (who.length) who.forEach((p, k) => b.presenters.push({ ...p, topic: k === 0 ? topic : "" }));
    else b.presenters.push({ name: "", title: "", org: "", topic });
  });
  b.discussants = peopleInLines(bucket.disc);
  b.attendees = peopleInLines(bucket.att);
  /* 같은 사람이 여러 자리에 잡혔으면 앞자리 것만 */
  const dedupe = (list, seen) => list.filter((p) => { if (!p.name || seen.has(p.name)) return false; seen.add(p.name); return true; });
  const seen = new Set();
  b.mc = dedupe(b.mc, seen); b.chair = dedupe(b.chair, seen);
  b.presenters = b.presenters.filter((p) => { if (!p.name) return true; if (seen.has(p.name)) return false; seen.add(p.name); return true; });
  b.discussants = dedupe(b.discussants, seen); b.attendees = dedupe(b.attendees, seen);
  if (!b.date && info && info.date) b.date = info.date;
  if (!b.title && info && info.rest) b.title = clean(info.rest.replace(/_/g, " "));
  return b;
}

/* ── 개요 → 글 ─────────────────────────────────────────────── */

/** 만난 사람 칸에 넣을 이름들 — 사회·좌장·발제·토론·참석 차례, 「이름 (소속)」 */
export function briefPeople(b, exclude) {
  const skip = new Set((exclude || []).map((x) => String(x).replace(/\s+/g, "")));
  const out = [], seen = new Set();
  [].concat(b.mc || [], b.chair || [], b.presenters || [], b.discussants || [], b.attendees || []).forEach((p) => {
    if (!p || !p.name || seen.has(p.name) || skip.has(p.name)) return;
    seen.add(p.name); out.push(personLabel(p));
  });
  return out;
}

const who = (list) => (list || []).map((p) => p.name + (p.title ? " " + p.title : "") + (p.org ? "(" + p.org + ")" : "")).join(", ");

/** 게시판 본문 — 개요를 개조식으로 */
export function briefBody(b, info) {
  const L = [];
  if (b.title) L.push("주제: " + b.title);
  if (b.date) L.push("일시: " + b.date.replace(/-/g, ".") + (b.time ? " " + b.time + (b.end ? "~" + b.end : "") : ""));
  if (b.place) L.push("장소: " + b.place);
  if (b.host || b.organizer) L.push("주최/주관: " + [b.host, b.organizer].filter(Boolean).join(" / "));
  if (b.mc.length) L.push("사회: " + who(b.mc));
  if (b.chair.length) L.push("좌장: " + who(b.chair));
  if (b.presenters.length) {
    L.push("발제:");
    b.presenters.forEach((p, i) => L.push("  " + (i + 1) + ". " + (p.topic ? p.topic + " — " : "") + (p.name ? who([p]) : "")));
  }
  if (b.discussants.length) L.push("토론: " + who(b.discussants));
  if (b.attendees.length) L.push("참석: " + who(b.attendees));
  if (b.program.length) {
    L.push("프로그램:");
    b.program.forEach((x) => L.push("  " + x.time + " " + x.what));
  }
  if (info && info.kind) L.push("역할: " + info.kind + (info.raw ? " · 자료: " + info.raw : ""));
  return L.join(NL);
}

/** 이름·낱말이 그 글 제목에 들어 있는가 — 「LH이미홍—토론」 ⊃ 「LH」 */
const tokens = (s) => String(s || "").split(/[^0-9A-Za-z가-힣]+/).map((x) => x.trim()).filter((x) => x.length >= 2);

/**
 * 그날 Schedule 글 가운데 이 행사의 글을 고릅니다.
 *   ① 폴더 이름과 제목이 같다  ② 같은 날, 폴더 이름·주제·주최의 낱말이 제목에 든다
 *   ③ 같은 날 [토론]·[발표]·[세미나참석] 말머리 글이 하나뿐이다
 * @returns row 또는 null
 */
export function pickRow(rows, info, b, sameTitle) {
  const R = (rows || []).filter((r) => r && r.category === "schedule");
  const same = sameTitle || ((x, y) => clean(x).toLowerCase() === clean(y).toLowerCase());
  let hit = R.find((r) => same(r.title, info.raw));
  if (hit) return hit;
  const day = R.filter((r) => String(r.event_date || "").slice(0, 10) === (b.date || info.date));
  if (!day.length) return null;
  const words = new Set(tokens(info.rest).concat(tokens(b.title), tokens(b.host), tokens(b.organizer)));
  const score = (r) => {
    const t = String(r.title || "") + " " + String(r.event || "");
    let n = 0;
    words.forEach((w) => { if (t.indexOf(w) >= 0) n += w.length; });
    tokens(t).forEach((w) => { if (w.length >= 2 && (info.rest.indexOf(w) >= 0 || (b.title || "").indexOf(w) >= 0)) n += 1; });
    return n;
  };
  const ranked = day.map((r) => [score(r), r]).sort((x, y) => y[0] - x[0]);
  if (ranked[0][0] > 0) return ranked[0][1];
  const tagged = day.filter((r) => /토론|발표|세미나|참석|자문|위원회|GRI행사/.test(String(r.tag || "")));
  if (tagged.length === 1) return tagged[0];
  /* 그날 일정 글이 하나뿐이면 그 글이 이 행사입니다 —
     구글에서 온 「LH이미홍ㅡ토론」 처럼 제목이 폴더와 전혀 달라도 새 글을 또 만들지 않게. */
  if (day.length === 1) return day[0];
  return null;
}

/**
 * 글에 얹을 고침 — 있는 글이면 비어 있는 칸만 채우되 시각·장소는 행사 정보를 믿습니다
 * (「01:30」 처럼 잘못 적힌 시각을 「13:30」 으로 바로잡는 것이 이 일의 까닭입니다).
 * @param mergePeople  (있던 만난 사람, [새 이름]) → 합친 글자 (notes-files.mergePeople)
 */
export function patchFor(b, row, info, mergePeople, exclude) {
  const p = {};
  const names = briefPeople(b, exclude);
  if (b.time && b.time !== (row && row.event_time)) p.event_time = b.time;
  if (b.place && b.place !== (row && row.place)) p.place = b.place;
  if (b.title && !(row && String(row.event || "").trim())) p.event = b.title;
  if (names.length) {
    const merged = mergePeople ? mergePeople(row && row.people, names) : names.join(", ");
    if (merged !== (row && row.people)) p.people = merged;
  }
  const body = briefBody(b, info);
  const cur = String((row && row.body) || "").trim();
  if (!cur) p.body = body;
  else if (b.title && cur.indexOf("주제: " + b.title) < 0 && cur.indexOf("발제:") < 0) p.body = body + NL + NL + cur;
  if (info && info.tag && !(row && row.tag)) p.tag = info.tag;
  if (b.date && !(row && row.event_date)) p.event_date = b.date;
  return p;
}

/** 폴더에 남겨 둘 개최개요.json — 1.회의록/받아쓰기.py · 세미나회의록.py 가 읽는 꼴 + 세미나 항목 */
export function briefJson(b, info) {
  const when = b.date ? b.date.replace(/-/g, ".") + (b.time ? " " + b.time + (b.end ? "~" + b.end : "") : "") : "";
  const people = briefPeople(b);
  const out = {
    "일시": when, "장소": b.place || "", "회의내용": b.title || "",
    "외부": people.join(", "), "인원": String(people.length + 1),
    "주제": b.title || "", "날짜": b.date || "", "시간": b.time || "", "끝시간": b.end || "",
    "주최": b.host || "", "주관": b.organizer || "",
    "사회": who(b.mc), "좌장": who(b.chair),
    "발제": (b.presenters || []).map((p) => ({ "이름": p.name, "직함": p.title, "소속": p.org, "제목": p.topic })),
    "토론": (b.discussants || []).map((p) => ({ "이름": p.name, "직함": p.title, "소속": p.org })),
    "참석": (b.attendees || []).map((p) => ({ "이름": p.name, "직함": p.title, "소속": p.org })),
    "프로그램": (b.program || []).map((x) => ({ "시간": x.time, "내용": x.what })),
    "출처": b.src || "행사 정보(info)",
  };
  if (info && info.kind) out["역할"] = info.kind;
  return out;
}

/** 개최개요.json → 개요 (거꾸로) — 이미 놓아 둔 것이 있으면 다시 읽지 않고 이것을 씁니다 */
export function briefFromJson(j, info) {
  if (!j || typeof j !== "object") return null;
  const P = (list) => (Array.isArray(list) ? list : []).map((x) => ({ name: x["이름"] || "", title: x["직함"] || "", org: x["소속"] || "", topic: x["제목"] || "" })).filter((x) => x.name || x.topic);
  const b = {
    title: j["주제"] || j["회의내용"] || "", date: j["날짜"] || dateIn(j["일시"] || "", info && info.date ? info.date.slice(0, 4) : ""),
    time: j["시간"] || timeIn(j["일시"] || "").time, end: j["끝시간"] || "", place: j["장소"] || "",
    host: j["주최"] || "", organizer: j["주관"] || "",
    mc: peopleInLine(j["사회"] || ""), chair: peopleInLine(j["좌장"] || ""),
    presenters: P(j["발제"]), discussants: P(j["토론"]), attendees: P(j["참석"]),
    program: (Array.isArray(j["프로그램"]) ? j["프로그램"] : []).map((x) => ({ time: x["시간"] || "", what: x["내용"] || "", who: [] })),
    src: j["출처"] || "개최개요.json",
  };
  /* 세미나 항목이 하나도 없는 옛 개최개요(일시·장소·외부만)면 외부를 참석으로 */
  if (!b.mc.length && !b.chair.length && !b.presenters.length && !b.discussants.length && !b.attendees.length && j["외부"]) {
    b.attendees = String(j["외부"]).split(/\s*,\s*/).filter(Boolean).map((s) => {
      const m = s.match(/^(.+?)\s*(?:\((.+)\))?$/); return { name: clean(m ? m[1] : s), title: "", org: clean(m && m[2] ? m[2] : "") };
    });
  }
  if (!b.date && info && info.date) b.date = info.date;
  return b;
}
