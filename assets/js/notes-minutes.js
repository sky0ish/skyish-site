// ─── 1.회의록 폴더를 그날 일정에 붙이기 ─────────────────────
//
//  1.회의록 안은 회의 하나가 폴더 하나입니다.
//
//    1.회의록/
//      20260824_국방연구원_남기헌_강소영_심승배/
//          20260824_…_회의록.pdf          ← 이것을 그날 일정에 붙입니다
//          20260824_…_회의록내용.json     ← 있으면 제목을 여기서 가져옵니다
//          20260824_….txt                 ← 있으면 요약을 본문에 담습니다
//          음성 260824_114513.m4a          ← 올리지 않습니다 (녹음은 내 컴퓨터에만)
//          pictures/ (또는 사진/)          ← 있으면 얼굴이 가장 많은 한 장만 함께
//          presentation/                   ← 있으면 발표자료 한 개도 함께 (PDF 먼저)
//
//  폴더 이름이 곧 자료입니다 — 날짜 · 기관/장소 · 만난 사람.
//
//  ※ 녹음(m4a)과 원본 한글 파일은 올리지 않습니다.
//     회의록 PDF 만 붙습니다.
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험할 수 있습니다
//  (tools/test/minutes.mjs).
import { looksLikeName } from "./notes-brief.js?v=202609010300";

/** 「오전」 「오후」 처럼 때를 가리키는 말 */
const WHEN_WORD = { 오전: "오전", 오후: "오후", 저녁: "저녁", 점심: "점심", 아침: "아침" };

/** 「20260824」 → 2026-08-24. 아니면 빈 글자 */
export function folderDate(name) {
  const m = String(name || "").match(/^(20\d\d)(\d{2})(\d{2})/);
  if (!m) return "";
  const mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return m[1] + "-" + m[2] + "-" + m[3];
}

/**
 * 폴더 이름을 뜯습니다.
 *   20260824_국방연구원_남기헌_강소영_심승배
 *     → { date:"2026-08-24", place:"국방연구원", people:["남기헌","강소영","심승배"], when:"" }
 *   20260827_오전_강은호_이선주
 *     → { date:"2026-08-27", place:"", people:["강은호","이선주"], when:"오전" }
 *   날짜가 아니면 date 가 빈 글자입니다 (그런 폴더는 건너뜁니다).
 */
export function parseFolder(name) {
  const raw = String(name || "").trim();
  const date = folderDate(raw);
  const out = { date, place: "", people: [], when: "", raw };
  if (!date) return out;
  const parts = raw.split("_").slice(1).map((s) => s.trim()).filter(Boolean);
  const orgs = [];
  parts.forEach((p) => {
    if (WHEN_WORD[p]) { out.when = WHEN_WORD[p]; return; }
    if (looksLikeName(p)) out.people.push(p);
    else orgs.push(p);
  });
  out.place = orgs.join(" ");
  return out;
}

/** 폴더 안에서 쓸 파일을 고릅니다 — 회의록 PDF 하나가 알맹이입니다.
 *  @param names 파일 이름 목록
 *  @returns {pdf, json, txt} — 없으면 빈 글자
 */
export function pickFiles(names, folder) {
  const L = (Array.isArray(names) ? names : []).filter(Boolean);
  const stem = String(folder || "");
  /* 폴더 이름으로 시작하는 것을 먼저 봅니다 — 남의 날 파일이 섞여 있어도
     제 것을 집게. 없으면 그냥 첫 번째를 씁니다. */
  const pick = (re) => L.filter((n) => re.test(n))
    .sort((x, y) => (y.indexOf(stem) === 0 ? 1 : 0) - (x.indexOf(stem) === 0 ? 1 : 0)
                 || verOf(y) - verOf(x))[0] || "";
  return {
    /* 「…_회의록.pdf」 만 봅니다. 「자문회의 개최건의….pdf」 같은 것은 아닙니다.
       회의록을 다시 쓰면 옛것을 덮지 않고 「…_회의록_v2.pdf」 로 늘어납니다 —
       그때는 **가장 새 판**을 붙입니다. */
    pdf: pick(/_회의록(_v\d+)?\.pdf$/i),
    json: pick(/_회의록내용(_v\d+)?\.json$/i),
    txt: pick(/\.txt$/i),
    slide: pickSlide(L),
  };
}

/** 「…_v3.pdf」 의 3. 판 표시가 없으면 1 (처음 것) 로 봅니다. */
export function verOf(name) {
  const m = /_v(\d+)\.[a-z0-9]+$/i.exec(String(name || ""));
  return m ? parseInt(m[1], 10) : 1;
}

/** 발표자료가 담긴 하위 폴더 이름 */
export const PRES_DIRS = ["presentation", "발표자료", "발표", "slides", "ppt"];

/** 이 폴더가 발표자료 폴더인가 */
export const isPresDir = (name) =>
  PRES_DIRS.some((d) => d.toLowerCase() === String(name || "").trim().toLowerCase());

/* 발표자료가 아닌 것들 — 회의록·개최건의·요약은 따로 다룹니다 */
const NOT_SLIDE = /(_회의록|회의록내용|개최\s*건의|개최\s*개요|자문회의)/;

/** 발표자료 한 개 — 「…final.pdf」 를 가장 먼저 봅니다.
 *  PDF 가 없으면 pptx 라도 씁니다 (게시판에서는 PDF 가 보기 좋습니다).
 *  「final 의 발표자료도 올려주고」 */
export function pickSlide(names) {
  const L = (Array.isArray(names) ? names : []).filter(Boolean).filter((n) => !NOT_SLIDE.test(n));
  const rank = (n) => {
    const pdf = /\.pdf$/i.test(n), ppt = /\.pptx?$/i.test(n);
    if (!pdf && !ppt) return -1;
    return (pdf ? 2 : 0) + (/final|최종/i.test(n) ? 1 : 0);
  };
  const best = L.map((n, i) => [n, rank(n), i])
    .filter(([, r]) => r >= 0)
    .sort((a, b) => b[1] - a[1] || a[2] - b[2])[0];
  return best ? best[0] : "";
}

/** presentation 폴더 안의 발표자료를 **모두** — 「그 안의 pdf자료를 …업로드해줘」
 *
 *  · PDF 가 하나라도 있으면 **PDF 만** 올립니다.
 *    같은 발표를 pptx 와 pdf 로 나란히 두시는 일이 많아, 둘 다 올리면 게시판에 겹칩니다.
 *    (탐색기는 확장자를 숨겨서 같은 이름 둘로 보입니다.)
 *  · PDF 가 하나도 없으면 그때만 pptx 를 올립니다.
 *  · 「final·최종」 이 붙은 것을 앞에 둡니다.
 *  · 회의록·개최건의는 발표자료가 아니라 여기서 빠집니다.
 */
export function pickSlides(names) {
  const L = (Array.isArray(names) ? names : []).filter(Boolean).filter((n) => !NOT_SLIDE.test(n));
  const pdfs = L.filter((n) => /\.pdf$/i.test(n));
  const use = pdfs.length ? pdfs : L.filter((n) => /\.pptx?$/i.test(n));
  return use
    .map((n, i) => [n, /final|최종/i.test(n) ? 1 : 0, i])
    .sort((a, b) => b[1] - a[1] || a[2] - b[2])
    .map(([n]) => n);
}

/** 글 제목 — 회의록내용.json 의 title 이 가장 좋습니다.
 *  없으면 기관·사람으로 짓고, 그것도 없으면 폴더 이름을 씁니다. */
export function titleOf(info, jsonTitle) {
  const t = String(jsonTitle || "").trim();
  if (t) return t.slice(0, 200);
  const who = (info.people || []).join(", ");
  const bits = [info.place, who].filter(Boolean);
  if (bits.length) {
    return bits.join(" — ") + (info.when ? " (" + info.when + ")" : "");
  }
  return info.raw || "회의록";
}

/* ── 개최개요가 없을 때 — 일정 게시판에서 가져옵니다 ──────────
   「음성파일만있고, 개최개요가 없을 경우, 내가 schedule상에 참석자 명단을
     적어줬다면, 개최개요를 니가 확인해서 sample대로 회의록 작성가능해?」

   1.회의록 의 받아쓰기.py 는 「개최건의 PDF」 에서 아래 값을 읽어
   sample.hwpx 를 채웁니다. PDF 가 없으면 그날 일정 글에서 같은 값을 만들어
   폴더에 「개최개요.json」 으로 놓아 둡니다. 받아쓰기.py 가 그것을 읽습니다. */

const WEEK7 = ["일", "월", "화", "수", "목", "금", "토"];

/** 「2026-09-08」 + 「14:00」 → 「2026년 9월8일(화요일) 14:00」 */
export function whenText(ymd, time) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d.getTime())) return "";
  const t = String(time || "").trim();
  return m[1] + "년 " + (+m[2]) + "월" + (+m[3]) + "일(" + WEEK7[d.getDay()] + "요일)" +
         (t ? " " + t : "");
}

/** 만난 사람 칸을 사람 수로 — 「김병규, 김성일 교수」 → 2 */
export const peopleCount = (s) =>
  String(s || "").split(/[,·\n]/).map((x) => x.trim()).filter(Boolean).length;

/** 그날 일정 글 → 받아쓰기.py 가 읽는 개최개요.
 *  받아쓰기.py 의 개최건의() 가 돌려주는 것과 **같은 열쇠**를 씁니다 —
 *  사업명 · 일시 · 장소 · 인원 · 외부 · 회의내용 · 출처.
 *  @param row  일정 글 {title, event_date, event_time, place, people, event, tag}
 *  @param info 폴더 이름에서 읽은 것 (사람 이름이 일정에 없을 때 갈음합니다)
 */
export function briefFromRow(row, info) {
  if (!row) return null;
  const r = row;
  const 사람 = String(r.people || "").trim() ||
               ((info && (info.people || []).join(", ")) || "");
  const out = {};
  const when = whenText(r.event_date, r.event_time);
  if (when) out["일시"] = when;
  if (String(r.place || "").trim()) out["장소"] = String(r.place).trim();
  if (사람) {
    out["외부"] = 사람;
    /* 받아쓰기.py 는 「인원 - 1」 을 바깥 사람 수로 봅니다 (안쪽 한 사람) */
    out["인원"] = String(peopleCount(사람) + 1);
  }
  const 내용 = String(r.event || "").trim() || String(r.title || "").trim();
  if (내용) out["회의내용"] = 내용;
  out["출처"] = "일정 게시판" + (r.title ? " — " + String(r.title).trim() : "");
  /* 날짜만 있는 것은 개최개요라 할 수 없습니다 —
     장소·참석자·회의내용 가운데 하나라도 있어야 놓아 둡니다. */
  const 쓸모 = ["장소", "외부", "회의내용"].some((k) => out[k]);
  return 쓸모 ? out : null;
}

/* 「만난 곳」 처럼 보이는 꼬리말 — 폴더 이름에서 장소를 갈음할 때 씁니다.
   받아쓰기.py 의 곳꼬리 와 같은 목록입니다. */
const PLACE_TAIL =
  /(연구원|연구소|대학교|대학|시청|도청|군청|구청|청|공사|공단|센터|캠퍼스|회관|호텔|본부|지사|사무소|병원|학교)$/;

/** 폴더 이름의 기관 가운데 「만난 곳」 같은 것 —
 *  「스타트업캠퍼스 워크숍」 → 스타트업캠퍼스, 「평택역개발 BT」 → 빈 글자 */
export function placeLike(text) {
  return String(text || "").split(/\s+/).find((w) => PLACE_TAIL.test(w)) || "";
}

/** 일정 글이 아예 없을 때 — 폴더 이름만으로 개최개요를 만듭니다.
 *  「여러 방식으로도 회의관련 내용을 채울수있으면 회의록 작성해줘」
 *  받아쓰기.py 도 폴더 이름을 보지만, 여기서 놓아 두면 사람이 열어 고칠 수 있습니다. */
export function briefFromFolder(info) {
  if (!info || !info.date) return null;
  const out = {};
  const when = whenText(info.date, "");
  if (when) out["일시"] = when;
  const place = placeLike(info.place);
  if (place) out["장소"] = place;
  if ((info.people || []).length) {
    out["외부"] = info.people.join(", ");
    out["인원"] = String(info.people.length + 1);
  }
  if (info.place) out["회의내용"] = info.place;
  out["출처"] = "폴더 이름 — " + (info.raw || "");
  const 쓸모 = ["장소", "외부", "회의내용"].some((k) => out[k]);
  return 쓸모 ? out : null;
}

/** 폴더에 이미 개최개요가 있는가 (PDF 든 우리가 놓아 둔 json 이든) */
export function hasBrief(names) {
  return (Array.isArray(names) ? names : []).some((n) =>
    /개최\s*개요\.json$/i.test(n) ||
    (/\.pdf$/i.test(n) && /(개최\s*건의|개최\s*개요|자문회의)/.test(n)));
}

/** 붙임 파일에 이미 같은 것이 있는가 */
export const alreadyHas = (files, name) =>
  (Array.isArray(files) ? files : []).some((f) => f && f.name === name);

/** 여러 폴더를 훑어 할 일 목록으로.
 *  @param folders [{name, files:[이름…], pics:[이름…]}]
 *         pics 는 그 회의 폴더 안 「pictures(사진)」 폴더의 그림들입니다.
 *  @returns [{date, place, people, when, title, pdf, json, txt, pics, raw}]
 *           날짜가 없거나 회의록 PDF 가 없는 폴더는 왜 건너뛰는지 함께 담습니다.
 */
export function plan(folders) {
  const jobs = [], skip = [];
  (Array.isArray(folders) ? folders : []).forEach((d) => {
    if (!d || !d.name) return;
    if (/^__|^\./.test(d.name)) return;              // __pycache__ 같은 것
    const info = parseFolder(d.name);
    if (!info.date) { skip.push({ name: d.name, why: "이름이 날짜로 시작하지 않습니다" }); return; }
    const f = pickFiles(d.files, d.name);
    if (!f.pdf) { skip.push({ name: d.name, why: "「…_회의록.pdf」 가 없습니다" }); return; }
    /* 사진 폴더가 있으면 이름만 실어 둡니다 —
       어느 것이 단체사진인지는 그림을 열어 봐야 알 수 있어 notes.js 가 고릅니다. */
    /* 사진·발표자료 폴더가 있으면 이름만 실어 둡니다 —
       어느 것이 단체사진인지는 그림을 열어 봐야 알 수 있어 notes.js 가 고릅니다. */
    const pres = Array.isArray(d.pres) ? d.pres.slice() : [];
    /* presentation 폴더가 있으면 그 안의 PDF 를 **모두** 올립니다.
       폴더가 없으면 회의 폴더에 흩어져 있는 발표자료 하나를 씁니다. */
    const slides = pres.length ? pickSlides(pres) : (f.slide ? [f.slide] : []);
    jobs.push({ ...info, ...f,
      pics: (Array.isArray(d.pics) ? d.pics : []).slice(),
      pres: pres,
      slides: slides,
      slide: slides[0] || "",          // 예전 이름 — 첫 장을 가리킵니다
      presFolder: pres.length > 0,
      title: "" });
  });
  jobs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { jobs, skip };
}
