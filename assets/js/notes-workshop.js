// ─── 워크샵·세미나 폴더를 통째로 Schedule 글로 ───────────────
//
//  1.세미나_토론 안은 행사 하나가 폴더 하나입니다.
//
//    1.세미나_토론/
//      20260910_[참석] WSCE_World Smart City Expo 2026/
//          회의록.hwpx            ← 글은 본문에, 안에 붙여 넣은 사진은 붙임으로
//          infro/  (intro)        ← 브로슈어·컨퍼런스북 PDF
//          Presentation/          ← 발표자료 (pptx 와 pdf 가 짝이면 PDF 만)
//          사진/  또는 그냥 jpg    ← 그날 찍은 사진 — 회의록 아래에 차례로 붙습니다
//          음성.m4a               ← 올리지 않습니다
//
//  「폴더명으로 게시판글 이름으로 해주면되. 회의록 아래에 사진이 쭉 붙게」
//    · 글 제목은 **폴더 이름 그대로**입니다.
//    · 붙임 차례 : 회의록 → 행사 정보 → 발표자료 → 사진(회의록 안 → 폴더)
//      게시판은 그림을 본문 아래에 펼쳐 보이므로, 사진이 회의록 아래에 쭉 이어집니다.
//    · 회의록에 이름 옆에 얼굴 사진이 붙어 있으면 그 이름의 주소록 사진으로도 갑니다
//      (얼굴 하나짜리 사진만 · 그 앞에 가장 가까이 적힌 사람).
//
//  화면이 없는 셈 모듈입니다 — node 나 브라우저 시험 페이지에서 곧바로 시험합니다
//  (tools/test/workshop.mjs).
import { peopleIn, looksLikeName } from "./notes-brief.js?v=202609010300";

const NL = String.fromCharCode(10);

/** 한 파일 20MB — notes-files.js 의 MAX 와 같아야 합니다 */
export const MAXSIZE = 20 * 1024 * 1024;

/* ── 폴더 이름 ──────────────────────────────────────────── */

/** 「20260910_[참석] WSCE_…」 → { raw, date:"2026-09-10", kind:"참석", rest:"WSCE_…" } */
export function parseFolder(name) {
  const raw = String(name || "").trim();
  const m = raw.match(/^(20\d\d)(\d{2})(\d{2})[_\s]*(?:\[([^\]]*)\])?[_\s]*(.*)$/);
  if (!m) return { raw, date: "", kind: "", rest: raw };
  const mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { raw, date: "", kind: "", rest: raw };
  return { raw, date: m[1] + "-" + m[2] + "-" + m[3], kind: (m[4] || "").trim(),
           rest: (m[5] || "").trim() };
}

/** [유형] → Schedule 말머리. 없으면 빈 글자 (말머리 없이 올립니다). */
export function tagFor(kind) {
  const k = String(kind || "");
  if (/자문\s*회의/.test(k)) return "자문회의";
  if (/자문/.test(k)) return "자문참석";
  if (/위원회/.test(k)) return "위원회";
  if (/토론/.test(k)) return "토론";
  if (/(발표|특강|강의|강연)/.test(k)) return "발표";
  if (/(세미나|참석|워크숍|워크샵|포럼|컨퍼런스|학회|박람회|엑스포)/i.test(k)) return "세미나참석";
  if (/GRI|경기연구원/i.test(k)) return "GRI행사";
  if (/회의/.test(k)) return "업무회의";
  return "";
}

/* ── 파일 갈래 ──────────────────────────────────────────── */

const JUNK = /^(~\$|\.)|^(desktop\.ini|Thumbs\.db)$/i;
const AUDIO = /\.(m4a|mp3|wav|aac|ogg|flac|wma|mp4|mov|avi)$/i;
export const IMG = /\.(jpe?g|png|webp|avif|heic|heif|gif|bmp)$/i;
const DOC = /\.(pdf|hwpx?|docx?|xlsx?|pptx?|txt|md)$/i;
const SKIP_DIRS = /^(references?|refs?|참고|참고자료|mid|중간본|old|backup|백업|__pycache__|\.claude|node_modules)$/i;
const INFO_DIRS = /^(intro|infro|info|행사정보|안내|프로그램|brochure)$/i;
const PRES_DIRS = /^(presentation|presentations|발표자료|발표|slides?|ppt|final|최종)$/i;
const PIC_DIRS = /^(사진|pictures?|photos?|img|images?|이미지)$/i;
const MINUTES = /(회의록|메모|녹취|기록|minutes|meeting[\s_-]*notes?)/i;
const INFO_NAME = /(개최\s*개요|개최\s*건의|프로그램|리플렛|브로슈어|안내|초청|공문|식순|일정표|conference\s*book|brochure|program|leaflet)/i;

/** 훑지 않을 폴더인가 (참고자료·중간본 — 남의 것이거나 무겁습니다) */
export const skipDir = (name) => SKIP_DIRS.test(String(name || "").trim());

/** 파일 하나의 갈래 —
 *  minutes(회의록) · text(회의록 글) · info(행사 정보) · slides(발표자료) · doc(그 밖의 자료)
 *  · pic(사진) · skip
 *  @param path 행사 폴더 안 상대 경로 ("infro/x.pdf")
 */
export function roleOf(path) {
  const p = String(path || "").replace(/\\/g, "/");
  const segs = p.split("/");
  const name = segs.pop();
  if (!name || JUNK.test(name)) return "skip";
  if (segs.some(skipDir)) return "skip";
  if (AUDIO.test(name) || /\.json$/i.test(name)) return "skip";
  const dir = segs.length ? segs[segs.length - 1] : "";

  if (IMG.test(name)) {
    if (!dir && INFO_NAME.test(name)) return "info";     // 개최개요.jpg 같은 것
    return "pic";
  }
  if (!DOC.test(name)) return "skip";
  if (MINUTES.test(name) && !/회의록내용/.test(name) && !PRES_DIRS.test(dir) && !INFO_DIRS.test(dir)) {
    return /\.(txt|md)$/i.test(name) ? "text" : "minutes";
  }
  if (INFO_DIRS.test(dir)) return "info";
  if (PRES_DIRS.test(dir)) return "slides";
  if (PIC_DIRS.test(dir)) return "skip";                  // 사진 폴더의 글은 안 봅니다
  if (INFO_NAME.test(name)) return "info";
  if (/\.(pdf|pptx?)$/i.test(name)) return "slides";
  return "doc";
}

/** 이름 차례 — 숫자를 알아듣게 (사진2 < 사진10) */
const byName = (a, b) => String(a).localeCompare(String(b), "ko", { numeric: true });

/** 같은 이름의 pptx·pdf 가 짝이면 PDF 만. final·최종이 앞에.
 *  pdfOnly 면 PDF 가 하나라도 있을 때 pptx 를 모두 뺍니다 — 발표자료는 같은 발표를
 *  「[PPT] …_final.pdf」 「[발표] ….pptx」 처럼 다른 이름으로 나란히 두시곤 합니다. */
export function pickDocs(paths, pdfOnly) {
  const L = (Array.isArray(paths) ? paths : []).filter(Boolean);
  const stem = (p) => p.replace(/\.[^./]+$/, "").toLowerCase();
  const pdfs = new Set(L.filter((p) => /\.pdf$/i.test(p)).map(stem));
  const dropPpt = (p) => /\.pptx?$/i.test(p) && (pdfs.has(stem(p)) || (pdfOnly && pdfs.size > 0));
  return L.filter((p) => !dropPpt(p))
    .map((p, i) => [p, /final|최종/i.test(p) ? 1 : 0, i])
    .sort((a, b) => b[1] - a[1] || byName(a[0], b[0]))
    .map(([p]) => p);
}

/** 사진 차례 — 폴더 바로 아래 것 먼저, 그다음 사진 폴더, 그다음 나머지. 안에서는 이름순. */
export function orderPics(paths) {
  const L = (Array.isArray(paths) ? paths : []).filter(Boolean);
  const rank = (p) => {
    const segs = p.split("/");
    if (segs.length === 1) return 0;
    return PIC_DIRS.test(segs[segs.length - 2]) ? 1 : 2;
  };
  return L.map((p) => [p, rank(p)]).sort((a, b) => a[1] - b[1] || byName(a[0], b[0])).map(([p]) => p);
}

/** 회의록이 여럿이면 가장 새 판(_v2, _v3)을 앞에, pdf 와 hwpx 가 짝이면 둘 다 (PDF 먼저) */
export function orderMinutes(paths) {
  const L = (Array.isArray(paths) ? paths : []).filter(Boolean);
  const ver = (p) => { const m = /_v(\d+)\.[a-z0-9]+$/i.exec(p); return m ? +m[1] : 1; };
  const ext = (p) => (/\.pdf$/i.test(p) ? 0 : /\.hwpx$/i.test(p) ? 1 : 2);
  return L.slice().sort((a, b) => ver(b) - ver(a) || ext(a) - ext(b) || byName(a, b));
}

/** 여러 폴더를 훑어 할 일 목록으로.
 *  @param folders [{name, files:[{path, name}]}] — path 는 행사 폴더 안 상대 경로
 *  @returns { jobs:[{raw,date,kind,tag,title,minutes,text,info,slides,docs,pics}], skip:[{name,why}] }
 */
export function plan(folders) {
  const jobs = [], skip = [];
  (Array.isArray(folders) ? folders : []).forEach((d) => {
    if (!d || !d.name) return;
    if (/^__|^\./.test(d.name)) return;
    const info = parseFolder(d.name);
    if (!info.date) { skip.push({ name: d.name, why: "이름이 날짜로 시작하지 않습니다" }); return; }
    const g = { minutes: [], text: [], info: [], slides: [], doc: [], pic: [] };
    (Array.isArray(d.files) ? d.files : []).forEach((f) => {
      const p = typeof f === "string" ? f : (f && f.path) || "";
      const r = roleOf(p);
      if (r !== "skip") g[r].push(p);
    });
    const job = {
      raw: info.raw, date: info.date, kind: info.kind, tag: tagFor(info.kind),
      title: info.raw.slice(0, 200),
      minutes: orderMinutes(g.minutes), text: g.text.slice().sort(byName),
      info: pickDocs(g.info), slides: pickDocs(g.slides, true), docs: pickDocs(g.doc),
      pics: orderPics(g.pic),
    };
    const n = job.minutes.length + job.text.length + job.info.length +
              job.slides.length + job.docs.length + job.pics.length;
    if (!n) { skip.push({ name: d.name, why: "붙일 회의록·자료·사진이 없습니다" }); return; }
    jobs.push(job);
  });
  jobs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { jobs, skip };
}

/** 붙임이 올라갈 차례 — 회의록 → 글 → 행사 정보 → 발표자료 → 자료 → 사진 */
export const attachOrder = (job) =>
  [].concat(job.minutes || [], job.text || [], job.info || [], job.slides || [],
            job.docs || [], job.pics || []);

/* ── 글 ─────────────────────────────────────────────────── */

/** 같은 글인가 — 빈칸·대소문자를 안 가립니다 */
export const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
export const sameTitle = (a, b) => !!norm(a) && norm(a) === norm(b);

/** 본문 — 자료 폴더 이름과 회의록 글. 너무 길면 자릅니다. */
export function buildBody(job, text, max) {
  const cap = max || 8000;
  const head = ["자료: " + (job.raw || "")];
  if (job.kind) head.push("역할: " + job.kind);
  let t = String(text || "").replace(/\r/g, "").trim();
  if (t.length > cap) t = t.slice(0, cap).replace(/\s+\S*$/, "") + NL + "… (회의록 파일에 이어집니다)";
  return head.join(NL) + (t ? NL + NL + t : "");
}

/* ── 회의록 안의 얼굴 사진 → 그 사람 ───────────────────────
   「이렇게 이름/사진 회의록에 들어가면 이름으로 인식해서 주소록에 사진 올려줘」
   회의록은 발표자 차례로 적으므로, 사진 **앞에 가장 가까이** 적힌 사람이
   그 사진의 주인입니다. 얼굴이 하나인지는 화면 쪽(notes.js)이 봅니다. */

const ORG_TAIL = /(연구원|연구소|대학교|대학|학교|시청|군청|도청|구청|공사|공단|재단|협회|학회|센터|본부|위원회|진흥원|개발원|사업단|조합|법인|주식회사|회사|기업|은행|부|처|청|원|국|과)$/;
const TITLE_WORD = /^(교수|박사|위원|위원장|연구위원|연구원|대표|이사|사장|본부장|센터장|실장|국장|과장|팀장|부장|차장|주무관|사무관|담당관|의원|시장|군수|지사|장관|차관|총장|학장|선임연구위원|소장|원장|회장|부회장|단장|대표이사|상무|전무|매니저|PM|CEO|CTO)$/i;

/** 한 줄에서 사람과 소속 — [{name, org, title}] (줄에 적힌 차례대로).
 *  「가능(4+2년)」 처럼 두 글자 낱말에 괄호가 붙은 것을 사람으로 보지 않게,
 *  직함이나 소속이 함께 적힌 사람만 봅니다. 주소록에 있는 이름(known)은 그냥도 봅니다. */
export function personsIn(line, known) {
  const t = String(line || "");
  const out = [];
  const isKnown = (n) => !!(known && typeof known.has === "function" && known.has(n));
  peopleIn(t).forEach((s) => {
    const m = /^(\S+)(?:\s*\((.*)\))?$/.exec(s);
    if (!m || !looksLikeName(m[1])) return;
    const name = m[1];
    let org = "", title = "";
    const tail = (m[2] || "").trim();
    if (tail) {
      const ws = tail.split(/\s+/);
      const tt = ws.filter((w) => TITLE_WORD.test(w));
      const oo = ws.filter((w) => !TITLE_WORD.test(w) && !/^\d+\s*(인|명)$/.test(w) && !/@/.test(w));
      title = tt.join(" ");
      if (oo.length && ORG_TAIL.test(oo[oo.length - 1])) org = oo.join(" ");
    }
    if (!org) {
      /* 「국토교통과학기술진흥원 김기욱 센터장」 — 이름 바로 앞 낱말이 기관이면 그것 */
      const at = t.indexOf(name);
      const before = t.slice(0, at).trim().split(/\s+/).pop() || "";
      const w = before.replace(/[()（）.,·]+$/, "");
      if (w.length >= 3 && /^[가-힣A-Za-z]+$/.test(w) && ORG_TAIL.test(w) && !looksLikeName(w)) org = w;
    }
    if (!title && !org && !isKnown(name)) return;
    out.push({ name, org, title, at: t.indexOf(name) });
  });
  /* 주소록에 있는 이름은 직함 없이 이름만 적혀 있어도 봅니다 —
     낱말로 서 있는 것만 (「김기욱」 은 되고 「김기욱씨네」 안의 것은 아닙니다) */
  if (known && typeof known.forEach === "function") {
    known.forEach((n) => {
      if (!looksLikeName(n) || out.some((x) => x.name === n)) return;
      const re = new RegExp("(^|[^가-힣])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![가-힣])");
      const m = re.exec(t);
      if (m) out.push({ name: n, org: "", title: "", at: m.index + m[1].length });
    });
  }
  return out.sort((a, b) => a.at - b.at).map(({ name, org, title }) => ({ name, org, title }));
}

/** 문단 목록에서 그림 id 가 든 문단을 찾아, 그 앞에 가장 가까이 적힌 사람.
 *  앞에 아무도 없으면 바로 뒤 두 문단 안의 첫 사람. 그래도 없으면 null.
 *  @param paras [{text, images:[id…]}] — hwpx.js 의 readHwpx 가 돌려주는 것
 *  @param known 주소록에 있는 이름들(Set) — 직함·소속 없이 이름만 적혀도 알아보게
 */
export function nameForImage(paras, imageId, known) {
  const P = Array.isArray(paras) ? paras : [];
  const at = P.findIndex((p) => p && (p.images || []).indexOf(imageId) >= 0);
  if (at < 0) return null;
  for (let i = at; i >= 0; i--) {
    const ps = personsIn(P[i].text, known);
    if (ps.length) return ps[ps.length - 1];
  }
  for (let i = at + 1; i <= at + 2 && i < P.length; i++) {
    const ps = personsIn(P[i].text, known);
    if (ps.length) return ps[0];
  }
  return null;
}
