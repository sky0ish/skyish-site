// ─── 주간점검회의 자료로 일정 맞추기 ─────────────────────────
//
//  「여기(주간점검회의)에 남지현 이름으로 올라오는 수정내용이 있으면 내 캘린더에 반영해줘.
//    추가하지 말고, 기존 내용을 해당 내용으로 수정」
//
//  경기연구원 주간점검회의 자료(PDF)는 부서마다 이런 꼴로 적혀 있습니다.
//    1. (대외, 남지현) 국토부 훼손지 정비사업 자문회의 참석
//       Ÿ 일시 및 장소 : 8월 31일(월) 14:00, 국토부 회의실
//       Ÿ 주제 : 남양주, 하남, 안산 관련 상정안건 자문
//    1. (옥진아, 남지현, 김희재) World Smart City Expo 2026 참가
//       Ÿ 일시 및 장소 : 9월 10일(목)~11일(금), 부산 BEXCO
//  그리고 성과보고회 표에는 「…과제명남지현9/909:15배영임」 처럼 이름 뒤에 날짜·시각이 붙습니다.
//
//  여기서는 글에서 **내 이름이 든 항목**만 뽑고, 같은 날의 기존 일정 글에 시각·장소·행사명을 맞춥니다.
//  화면이 없는 셈 모듈입니다 (tools/test/weekly.mjs).

const NL = String.fromCharCode(10);
const pad = (n) => String(n).padStart(2, "0");

/** 자료 머리의 「회 의 자 료2026. 9. 7. ~ 9. 11.」 에서 해 · 주간을 읽습니다 */
export function weekOf(text) {
  const t = String(text || "").replace(/\s+/g, " ");
  const m = t.match(/(20\d\d)\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.?\s*~\s*(?:(\d{1,2})\s*\.\s*)?(\d{1,2})\s*\./);
  if (!m) return null;
  const y = +m[1], m1 = +m[2], d1 = +m[3], m2 = m[4] ? +m[4] : m1, d2 = +m[5];
  return { year: y, from: y + "-" + pad(m1) + "-" + pad(d1), to: y + "-" + pad(m2) + "-" + pad(d2) };
}

/** 「9월 10일(목)」 「9/9(수)」 「9.9.(수)」 「2026.9.8.(화)」 → 2026-09-10 (year 는 자료의 해) */
export function dateIn(s, year) {
  const t = String(s || "");
  let m = t.match(/(?:(20\d\d)\s*[.년]\s*)?(\d{1,2})\s*[월./]\s*(\d{1,2})\s*일?\s*\.?\s*(?:\([월화수목금토일]\))?/);
  if (!m) return "";
  const y = m[1] ? +m[1] : (year || new Date().getFullYear());
  const mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return "";
  return y + "-" + pad(mo) + "-" + pad(d);
}

/** 「14:00」 「오후 2시」 「10시 30분」 「09:15」 → 14:00 (없으면 빈 글자) */
export function timeIn(s) {
  const t = String(s || "");
  let m = t.match(/(\d{1,2}):(\d{2})/);
  if (m) return pad(+m[1]) + ":" + m[2];
  m = t.match(/(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
  if (m) {
    let h = +m[2];
    if (m[1] === "오후" && h < 12) h += 12;
    return pad(h) + ":" + pad(m[3] ? +m[3] : 0);
  }
  return "";
}

/** 「9월 10일(목)~11일(금), 부산 BEXCO」 → { date, dateTo, time, place } */
export function whenWhere(s, year) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  const date = dateIn(t, year);
  let dateTo = "";
  const rng = t.match(/~\s*(?:(\d{1,2})\s*[월./]\s*)?(\d{1,2})\s*일?\s*(?:\([월화수목금토일]\))?/);
  if (rng && date) {
    const mo = rng[1] ? +rng[1] : +date.slice(5, 7);
    dateTo = date.slice(0, 4) + "-" + pad(mo) + "-" + pad(+rng[2]);
  }
  const time = timeIn(t);
  /* 장소 — 마지막 쉼표 뒤. 「장소 미정」 이면 비웁니다 */
  let place = "";
  const cut = t.lastIndexOf(",");
  if (cut >= 0) place = t.slice(cut + 1).trim();
  else {
    const after = t.replace(/^.*?(?:\([월화수목금토일]\)|\d{1,2}:\d{2})/, "").trim();
    if (after && !/^\d/.test(after)) place = after;
  }
  place = place.replace(/^(장소\s*[:：]?\s*)/, "").replace(/\s*(장소\s*)?미정$/, "").trim();
  if (/^\d{1,2}:\d{2}$/.test(place) || /^\d+일/.test(place)) place = "";
  return { date, dateTo, time, place };
}

/** 이름이 낱말로 들었는가 */
const hasName = (text, name) =>
  new RegExp("(^|[^가-힣])" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![가-힣])").test(String(text || ""));

/**
 * 자료 전체 글에서 내 항목을 뽑습니다.
 * @param text   PDF 에서 뽑은 글 (쪽을 이어 붙인 것)
 * @param opt    { names: ["남지현"], year }
 * @returns [{ kind, owner, title, date, dateTo, time, place, note, src }]
 */
export function parseWeekly(text, opt) {
  const o = Object.assign({ names: ["남지현"] }, opt || {});
  const raw = String(text || "").replace(/\r/g, "");
  const wk = weekOf(raw);
  const year = o.year || (wk && wk.year) || new Date().getFullYear();
  /* 불릿 「Ÿ」·「•」·「·」 을 줄바꿈으로, 「N. (…)」 항목 머리를 줄바꿈으로 */
  const t = raw.replace(/[Ÿ•]/g, NL + "@").replace(/(\d{1,2})\.\s*\(([^)]{1,40})\)/g, NL + "#$1. ($2)");
  const lines = t.split(NL).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out = [];
  let cur = null;
  const push = () => { if (cur && cur.date) out.push(cur); cur = null; };
  lines.forEach((line) => {
    const head = line.match(/^#(\d{1,2})\.\s*\(([^)]+)\)\s*(.*)$/);
    if (head) {
      push();
      const owner = head[2].trim();
      const mine = o.names.some((n) => hasName(owner, n));
      /* 제목은 다음 「N.」 항목이나 표 머리가 붙기 전까지 */
      const title = head[3].replace(/\s*\d{1,2}\.\s*$/, "").replace(/(❑.*|<.*)$/, "").trim();
      cur = mine ? { kind: owner.split(/\s*,\s*/)[0], owner, title, date: "", dateTo: "", time: "", place: "", note: "", src: "항목" } : null;
      return;
    }
    if (line.startsWith("@")) {
      const b = line.slice(1).trim();
      if (!cur) return;
      const m = b.match(/^(일시\s*(?:및|·|\/)?\s*장소|일시|일정|장소|시간)\s*[:：]\s*(.*)$/);
      if (m) {
        const ww = whenWhere(m[2], year);
        if (/장소$/.test(m[1]) && !/일/.test(m[1])) { cur.place = cur.place || ww.place || m[2].trim(); return; }
        if (ww.date) { cur.date = ww.date; cur.dateTo = ww.dateTo; }
        if (ww.time) cur.time = ww.time;
        if (ww.place) cur.place = ww.place;
        return;
      }
      const n = b.match(/^(주제|내용|발표주제|안건)\s*[:：]\s*(.*)$/);
      if (n) cur.note = (cur.note ? cur.note + " / " : "") + n[2].trim();
      return;
    }
  });
  push();

  /* 표 꼴 — 「…과제명남지현9/909:15배영임」 「…과제명남지현-8.31」 (성과보고회·연구위원회) */
  o.names.forEach((name) => {
    /* 날짜 뒤에 시각이 바로 붙는 「9/909:15」 는 날(日)을 게으르게 잡아 「9/9」 + 「09:15」 로 읽습니다 */
    const re = new RegExp("([가-힣A-Za-z0-9 ·:,\\-()「」]{6,80}?)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
      "\\s*(-)?\\s*(\\d{1,2}[./]\\d{1,2}?)(?=\\d{2}:\\d{2}|\\D|$)\\s*(\\d{1,2}:\\d{2})?", "g");
    let m;
    while ((m = re.exec(raw))) {
      /* 앞에 붙은 표 머리·갈래 말(정책·기초·수탁·신규·일반 …)과 앞 줄 평가위원 이름을 떼어 냅니다 */
      let title = m[1].replace(/\s{2,}/g, " ").trim();
      for (let k = 0; k < 4; k++) {
        const c = title.match(/^[가-힣A-Za-z]{0,6}?(정책|기초|수탁|일반|브리프|신규|도정지원|대외|구분|과제명|책임자|개최일|시간|내부평가위원|연구위원회|성과보고회)/);
        if (!c) break;
        title = title.slice(c[0].length).trim();
      }
      /* 표 칸이 붙어 온 것 — 「…김동영정책경기도 피지컬…」 은 마지막 갈래 말(정책·기초…) 바로 뒤가 과제명입니다.
         갈래 말 뒤에 띄어쓰기 없이 한글이 붙을 때만 자릅니다 (「지원 정책 연구」 같은 제목은 그대로). */
      const cutRe = /(정책|기초|수탁|일반|브리프|신규|도정지원)(?=[가-힣A-Z])/g;
      let last = -1, cm;
      while ((cm = cutRe.exec(title))) last = cm.index + cm[1].length;
      if (last > 0) title = title.slice(last).trim();
      /* PDF 가 글자 사이를 띄운 「경 기 도  피 지 컬」 은 붙입니다 — 낱자가 대부분이면 */
      const toks = title.split(" ");
      if (toks.length >= 6 && toks.filter((w) => w.length === 1).length > toks.length * 0.6) title = title.replace(/ /g, "");
      title = title.replace(/^[\d\-:., ]+/, "").trim();
      const date = dateIn(m[3], year);
      if (!date || title.length < 4) continue;
      const kind = m[2] ? "연구위원회" : "성과보고회";
      const time = m[4] ? timeIn(m[4]) : "";
      /* 같은 날 같은 갈래가 두 표(요약표·일정표)에 나오면 시각이 있는 쪽 하나만 */
      const dup = out.findIndex((x) => x.src === "표" && x.date === date && x.kind === kind);
      if (dup >= 0) { if (time && !out[dup].time) out[dup] = { ...out[dup], title: kind + " — " + title, time }; continue; }
      out.push({ kind, owner: name, title: kind + " — " + title, date, dateTo: "", time, place: "", note: "", src: "표" });
    }
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ── 기존 일정 글에 맞추기 ─────────────────────────────────── */

const norm = (s) => String(s || "").toLowerCase().replace(/[\s「」『』\[\]()（）,.·:/\-_~「」"'!?]/g, "");
const words = (s) => String(s || "").split(/[\s「」『』\[\](),.·:/\-_~"'!?]+/).map((w) => w.trim()).filter((w) => w.length >= 2);

/** 두 글이 얼마나 겹치는지 — 낱말 겹침 수 */
export function overlap(a, b) {
  const A = words(a), B = new Set(words(b));
  const nb = norm(b);
  let n = 0;
  A.forEach((w) => { if (B.has(w) || (w.length >= 3 && nb.indexOf(norm(w)) >= 0)) n++; });
  return n;
}

/**
 * 뽑은 항목을 같은 날의 일정 글에 짝지어, 고칠 값을 만듭니다. 새 글은 만들지 않습니다.
 * @param items  parseWeekly 결과
 * @param rows   게시판 글 [{id, category, title, event_date, event_time, place, event, tag}]
 * @returns { changes:[{item, row, patch, why}], skipped:[{item, why}] }
 */
export function matchItems(items, rows) {
  const posts = (Array.isArray(rows) ? rows : []).filter((r) => r && r.category === "schedule" && r.event_date);
  const changes = [], skipped = [];
  const used = new Set();
  (Array.isArray(items) ? items : []).forEach((it) => {
    const day = posts.filter((r) => String(r.event_date).slice(0, 10) === it.date && !used.has(r.id));
    if (!day.length) { skipped.push({ item: it, why: "그날 일정 글이 없습니다 (새로 만들지 않습니다)" }); return; }
    let best = null, score = -1;
    day.forEach((r) => {
      const sc = overlap(it.title, [r.title, r.event].join(" ")) + (it.note ? overlap(it.note, r.title) * 0.5 : 0);
      if (sc > score) { score = sc; best = r; }
    });
    if (day.length > 1 && score < 1) { skipped.push({ item: it, why: "그날 글이 여럿인데 어느 것인지 가릴 수 없습니다" }); return; }
    const patch = {};
    if (it.time && it.time !== (best.event_time || "")) patch.event_time = it.time;
    if (it.place && it.place !== (best.place || "")) patch.place = it.place;
    if (it.title && it.title !== (best.event || "")) patch.event = it.title;
    if (!Object.keys(patch).length) { skipped.push({ item: it, why: "이미 같습니다" }); used.add(best.id); return; }
    used.add(best.id);
    changes.push({ item: it, row: best, patch, why: score >= 1 ? "제목이 " + score + "낱말 겹침" : "그날 유일한 글" });
  });
  return { changes, skipped };
}
