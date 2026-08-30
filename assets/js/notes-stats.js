// ─── 사람들 — 세어 보기 ────────────────────────────────────
//
//  Schedule · Diary 를 비롯한 모든 글의 「만난 사람」 칸을 바탕으로
//    · 달마다 몇 사람을 몇 번 만났는지
//    · 가장 자주 만난 열 분
//    · 사람 · 기관 · 행사 낱말의 쓰임새
//  를 셉니다.
//
//  여기에는 화면이 없습니다. 셈만 합니다.
//  그래야 브라우저 없이도 node 로 곧바로 시험할 수 있습니다.
//  (tools/test/stats.mjs)

/** 「홍길동 (경기연구원)」 → { name:"홍길동", org:"경기연구원" } */
export function splitPerson(one) {
  const t = String(one || "").trim();
  const m = t.match(/^(.+?)\s*[(（]\s*(.+?)\s*[)）]\s*$/);
  return m
    ? { name: m[1].trim(), org: m[2].trim() }
    : { name: t, org: "" };
}

/** 한 글에 적힌 만난 사람들 — 쉼표·가운뎃점으로 끊습니다 */
export function peopleOf(row) {
  return String((row && row.people) || "")
    .split(/\s*[,·]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** 날짜를 YYYY-MM 으로. 날짜가 없으면 적은 날로 갈음합니다. */
export function monthOf(row) {
  const d = (row && (row.event_date || row.created_at)) || "";
  const m = String(d).match(/^(\d{4})-(\d{2})/);
  return m ? m[1] + "-" + m[2] : "";
}

/* ── 사람별로 모으기 ─────────────────────────────────────── */

/**
 * @returns {Array<{key,label,org,meets:Array}>}  자주 만난 순
 */
export function byPerson(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    peopleOf(r).forEach((one) => {
      const { name, org } = splitPerson(one);
      if (!name) return;
      const got = map.get(name) || { key: name, label: name, org: "", meets: [] };
      // 소속까지 적힌 쪽을 이름표로 씁니다
      if (org && one.length > got.label.length) { got.label = one; got.org = org; }
      if (got.meets.indexOf(r) < 0) got.meets.push(r);
      map.set(name, got);
    });
  });
  return [...map.values()].sort((a, b) =>
    b.meets.length - a.meets.length || a.key.localeCompare(b.key, "ko"));
}

/** 가장 자주 만난 분들 */
export function topPeople(rows, n = 10) {
  return byPerson(rows).slice(0, n);
}

/* ── 사람에 대한 메모 ────────────────────────────────────────
   본문에 「(사람) 이석준 군협력담당관님께 넘 감사드립니다.」 처럼
   말머리를 붙여 적으면, 그 줄을 그 사람의 기록으로 모읍니다.
   말머리는 (사람)·[사람]·(인물)·(person) 을 받습니다. */
const NOTE_HEAD = /^\s*[(\[（]\s*(?:사람|인물|person|People|PEOPLE)\s*[)\]）]\s*/;

/** 본문에서 「(사람)」 줄만 뽑아냅니다 — 말머리는 떼어 냅니다 */
export function personNotes(body) {
  return String(body || "").split(/\r?\n/)
    .filter((l) => NOTE_HEAD.test(l))
    .map((l) => l.replace(NOTE_HEAD, "").trim())
    .filter(Boolean);
}

/**
 * 그 줄이 누구 이야기인지 가립니다.
 *   · 글의 「만난 사람」 에 적힌 이름이 줄 안에 있으면 그 사람
 *   · 없으면 줄 맨 앞의 두세 글자 한글 이름을 그 사람으로 봅니다
 * @returns [{ name, text }]
 */
export function noteOwners(line, people) {
  const who = (people || []).map((p) => splitPerson(p).name).filter(Boolean);
  const hit = who.filter((n) => n.length >= 2 && line.includes(n));
  if (hit.length) return hit.map((name) => ({ name, text: line }));
  const m = line.match(/^([가-힣]{2,4})(?:\s|님|씨|은|는|이|가|을|를|께|과|와|,|$)/);
  return m ? [{ name: m[1], text: line }] : [];
}

/**
 * 모든 글에서 사람별 메모를 모읍니다.
 * @returns Map: 이름 → [{ text, row }]
 */
export function notesByPerson(rows) {
  const map = new Map();
  (rows || []).forEach((r) => {
    const people = peopleOf(r);
    personNotes(r.body).forEach((line) => {
      noteOwners(line, people).forEach(({ name, text }) => {
        const arr = map.get(name) || [];
        if (!arr.some((x) => x.text === text && x.row === r)) arr.push({ text, row: r });
        map.set(name, arr);
      });
    });
  });
  return map;
}


/** 직함으로 볼 만한 꼬리말 */
const TITLE_TAIL =
  "담당관|주무관|사무관|서기관|과장|팀장|부장|국장|실장|본부장|센터장|단장|" +
  "소장|원장|처장|차장|대표|이사|사장|회장|교수|박사|연구위원|연구원|" +
  "선임연구위원|책임연구원|위원장|위원|의원|시장|군수|지사|장관|차관|" +
  "대령|중령|소령|대위|준장|소장급|사령관|참모|팀원|매니저|기사|소방관|경위";
/* 직함은 「낱말 통째로」 잡습니다.
   꼬리말만 보면 「군협력담당관」 이 「담당관」 으로 잘리고,
   「국방연구원 책임연구위원」 은 「연구원」 만 남습니다. */
const TAIL_RE = new RegExp("(?:" + TITLE_TAIL + ")$");
const 토씨 = /(님|씨|은|는|이|가|을|를|와|과|도|만|의|께|에게|한테)$/;

function 낱말들(text) {
  return String(text || "").split(/[\s,·]+/).filter(Boolean);
}

/** 낱말 하나가 직함인가 — 뒤에 붙은 토씨는 떼고 봅니다 */
/* 「연구원」 은 직함이면서 기관 이름이기도 합니다.
   「국방연구원」 처럼 앞에 다른 말이 붙으면 기관으로 봅니다. */
const 기관꼴 = /(연구원|연구소|대학교|대학|학회|협회|재단|공사|공단|진흥원|위원회|센터|본부|청|부)$/;
function 기관인가(w) {
  return 기관꼴.test(w) && w.length >= 4 &&
    !/^(선임|책임|수석|전임)/.test(w);
}

function 직함(word) {
  let w = word.replace(/[.,!?)]+$/, "");
  if (기관인가(w)) return "";
  for (let k = 0; k < 3; k++) {                 // 「담당관님께」 처럼 겹친 토씨
    if (TAIL_RE.test(w)) return w;
    const cut = w.replace(토씨, "");
    if (cut === w) break;
    w = cut;
  }
  return TAIL_RE.test(w) ? w : "";
}

/**
 * 그 사람의 메모에서 「소속 직함」 을 찾아냅니다.
 *   「이석준 군협력담당관님께 넘 감사드립니다」 → 군협력담당관
 *   「이석준 이천시청 군협력담당관」          → 이천시청 군협력담당관
 * 여러 줄이 있으면 가장 자세한 것을 씁니다. 못 찾으면 빈 글입니다.
 */
export function whoTitle(name, notes) {
  let best = "";
  for (const n of (notes || [])) {
    const line = typeof n === "string" ? n : (n && n.text) || "";
    // 이름 뒤쪽만 봅니다 — 앞의 다른 말이 섞이지 않게
    const at = line.indexOf(name);
    const ws = 낱말들(at >= 0 ? line.slice(at + name.length) : line);

    for (let k = 0; k < ws.length; k++) {
      const t = 직함(ws[k]);
      if (!t) continue;
      // 바로 앞 낱말이 소속처럼 보이면 함께 씁니다
      const prev = k > 0 ? ws[k - 1].replace(/[.,!?)]+$/, "") : "";
      const org = (prev && !토씨.test(prev) && !직함(prev) && prev.length >= 2) ? prev : "";
      const got = (org ? org + " " : "") + t;
      if (got.length > best.length) best = got;
      break;                                     // 한 줄에서 첫 직함만
    }
  }
  return best;
}


/* ── 달마다 ──────────────────────────────────────────────── */

/**
 * 오늘이 든 달까지 거슬러 months 개월.
 * @returns {Array<{ym, label, meets, people, names:Set}>}  옛날 → 요즘
 */
export function monthly(rows, months = 12, today = new Date()) {
  const out = [];
  const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  const at = new Date(today.getFullYear(), today.getMonth(), 1);

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(at.getFullYear(), at.getMonth() - i, 1);
    out.push({
      ym: key(d),
      label: (d.getMonth() === 0 || i === months - 1)
        ? d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0")
        : String(d.getMonth() + 1),
      meets: 0, people: 0, names: new Set(),
    });
  }
  const by = new Map(out.map((x) => [x.ym, x]));

  (rows || []).forEach((r) => {
    const b = by.get(monthOf(r));
    if (!b) return;
    const who = peopleOf(r);
    if (!who.length) return;
    b.meets += 1;                                  // 만난 자리 한 번
    who.forEach((one) => b.names.add(splitPerson(one).name));
  });
  out.forEach((b) => { b.people = b.names.size; });
  return out;
}

/* ── 낱말 세기 (텍스트마이닝) ────────────────────────────── */

/** 기관으로 볼 만한 꼬리말 */
const ORG_TAIL =
  "연구원|연구소|연구단|사업단|대학교|대학원|대학|학회|협회|재단|공사|공단|진흥원|" +
  "위원회|센터|본부|연맹|조합|공제회|은행|병원|" +
  /* 「청」 붙는 곳은 하나씩 적습니다.
     그냥 「도청」 으로 두면 「대전철도청」 이 「대전철」+「도청」 으로 우연히 걸립니다.
     결과는 같아도 까닭이 틀린 규칙은 언젠가 엉뚱한 것을 줍습니다. */
  "시청|도청|구청|군청|교육청|철도청|경찰청|국세청|산림청|기상청|조달청|특허청|통계청|" +
  "아카데미|연구회|사무소|사무국|지원단|추진단|기술원|박물관|미술관|도서관|공원|공방";
const ORG_RE = new RegExp("([가-힣A-Za-z0-9]{2,20}(?:" + ORG_TAIL + "))", "g");

/** 셈에서 빼는 흔한 말 */
const STOP = new Set([
  "및", "등", "관련", "위한", "대한", "에서", "그리고", "통한", "있는", "하는", "되는",
  "이번", "저번", "오늘", "내일", "어제", "오전", "오후", "우리", "제가", "저는",
  "회의", "참석", "진행", "논의", "개최", "예정", "관하여", "관해", "대해", "함께",
  "the", "and", "for", "with", "of", "in", "on", "to", "a", "an",
]);

/** 셈에 넣을 만한 낱말인가 */
export function keepWord(w) {
  const t = String(w || "").trim();
  if (t.length < 2 || t.length > 20) return false;
  if (STOP.has(t.toLowerCase())) return false;
  if (/^[\d\s:~\-.,]+$/.test(t)) return false;          // 숫자·날짜만
  if (/^(20\d\d|19\d\d)년?$/.test(t)) return false;      // 연도
  if (/^\d+(회|차|번|년|월|일|시|분|명|건|호)$/.test(t)) return false;
  return true;
}

const bump = (m, k, row) => {
  if (!k) return;
  const g = m.get(k) || { word: k, n: 0, rows: [] };
  g.n += 1;
  if (g.rows.indexOf(row) < 0) g.rows.push(row);
  m.set(k, g);
};
const sorted = (m, n) => [...m.values()]
  .sort((a, b) => b.n - a.n || a.word.localeCompare(b.word, "ko"))
  .slice(0, n);

/** ① 사람 — 만난 사람 이름 */
export function wordsPeople(rows, n = 40) {
  const m = new Map();
  (rows || []).forEach((r) =>
    peopleOf(r).forEach((one) => bump(m, splitPerson(one).name, r)));
  return sorted(m, n);
}

/** ② 기관 — 이름 옆 괄호 안의 소속, 그리고 글 속의 기관 이름 */
export function wordsOrg(rows, n = 40) {
  const m = new Map();
  (rows || []).forEach((r) => {
    peopleOf(r).forEach((one) => {
      const { org } = splitPerson(one);
      if (org) org.split(/\s*[,/·]\s*/).forEach((o) => {
        const t = o.trim();
        if (t.length >= 2) bump(m, t, r);
      });
    });
    // 행사명·제목·장소에 적힌 기관 이름도 줍습니다
    const text = [r.event, r.title, r.place].filter(Boolean).join(" ");
    (text.match(ORG_RE) || []).forEach((o) => bump(m, o, r));
  });
  return sorted(m, n);
}

/** ③ 행사 낱말 — 행사명·말머리·제목에서 */
export function wordsEvent(rows, n = 40) {
  const m = new Map();
  /* 만난 사람의 이름은 뺍니다 — 제목에 「(박진우) 자치행정 토론」 처럼
     이름이 적히면 사람이 주제 낱말로도 잡혀 그림에 두 번 나옵니다. */
  const isName = new Set();
  (rows || []).forEach((r) =>
    peopleOf(r).forEach((one) => isName.add(splitPerson(one).name)));
  (rows || []).forEach((r) => {
    const text = [r.event, r.tag, r.title].filter(Boolean).join(" ");
    text
      // 날짜·시각 토막을 먼저 걷어 냅니다
      .replace(/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/g, " ")
      .replace(/\(\s*[월화수목금토일]\s*\)/g, " ")
      .split(/[\s,./·「」【】\[\]()（）:;•~"'!?_+=|\\]+/)
      .map((w) => w.replace(/^[제第]/, "").trim())
      /* 이름 그대로만이 아니라 「김진령주무관」 「남편이랑」 처럼
         이름으로 시작하는 낱말도 사람입니다 — 직함·토씨가 붙었을 뿐입니다. */
      .filter((w) => keepWord(w) && !isName.has(w) &&
        ![...isName].some((nm) => nm.length >= 2 && w.startsWith(nm)))
      .forEach((w) => bump(m, w, r));
  });
  return sorted(m, n);
}

/** 구름에 쓸 글자 크기 — 가장 잦은 것을 1, 가장 드문 것을 0 으로 */
export function scale(list) {
  if (!list.length) return [];
  const hi = list[0].n, lo = list[list.length - 1].n;
  return list.map((x) => ({
    ...x,
    /* 잦기 차이가 작을 때 다 같아 보이지 않도록 제곱근을 씁니다 */
    t: hi === lo ? 1 : Math.sqrt((x.n - lo) / (hi - lo)),
  }));
}

/** 이 셈이 다루는 자료의 테두리 — 언제부터 언제까지, 몇 건, 어느 게시판 */
export function span(rows) {
  const dated = [];
  let count = 0;
  const byCat = {};
  (rows || []).forEach((r) => {
    if (!peopleOf(r).length) return;         // 만난 사람이 없는 글은 셈 밖입니다
    count += 1;
    const c = (r && r.category) || "etc";
    byCat[c] = (byCat[c] || 0) + 1;
    const m = String((r && (r.event_date || r.created_at)) || "").match(/^\d{4}-\d{2}-\d{2}/);
    if (m) dated.push(m[0]);
  });
  dated.sort();
  const from = dated[0] || "", to = dated[dated.length - 1] || "";
  let months = 0;
  if (from && to) {
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    months = (ty - fy) * 12 + (tm - fm) + 1;   // 걸친 달 수 — 8월~8월이면 1
  }
  return { from, to, months, count, byCat };
}

/** 달 수를 사람 말로 — 1년 6개월 · 8개월 */
export function spanWord(months) {
  if (!months) return "";
  const y = Math.floor(months / 12), m = months % 12;
  return (y ? y + "년" : "") + (y && m ? " " : "") + (m ? m + "개월" : "");
}

/** 한눈 요약 */
export function summary(rows, today = new Date()) {
  const ppl = byPerson(rows);
  const ym = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0");
  const thisMonth = new Set();
  let meets = 0;
  (rows || []).forEach((r) => {
    const who = peopleOf(r);
    if (!who.length) return;
    meets += 1;
    if (monthOf(r) === ym) who.forEach((o) => thisMonth.add(splitPerson(o).name));
  });
  return {
    people: ppl.length,
    meets,
    thisMonth: thisMonth.size,
    most: ppl[0] || null,
  };
}
