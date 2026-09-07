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
    .sort((x, y) => (y.indexOf(stem) === 0 ? 1 : 0) - (x.indexOf(stem) === 0 ? 1 : 0))[0] || "";
  return {
    /* 「…_회의록.pdf」 만 봅니다. 「자문회의 개최건의….pdf」 같은 것은 아닙니다 */
    pdf: pick(/_회의록\.pdf$/i),
    json: pick(/_회의록내용\.json$/i),
    txt: pick(/\.txt$/i),
    slide: pickSlide(L),
  };
}

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
    jobs.push({ ...info, ...f, pics: (Array.isArray(d.pics) ? d.pics : []).slice(), title: "" });
  });
  jobs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { jobs, skip };
}
