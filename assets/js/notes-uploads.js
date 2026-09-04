// ─── 올린 자료 모아 보기 ────────────────────────────────────
//
//  게시판 글마다 흩어져 있는 붙임 파일을 한자리에 모읍니다.
//  글을 하나씩 열어 보지 않아도 「무엇을 올렸는지」 가 한눈에 들어오고,
//  거기서 곧바로 내려받을 수 있습니다.
//
//  화면이 없는 셈 모듈입니다 — node 로 곧바로 시험할 수 있습니다
//  (tools/test/uploads.mjs). 임시 주소를 받아 오는 일과 화면에 거는 일은
//  notes.js 쪽에 있습니다.

/** 종류 묶음 — 파일 하나하나의 type 을 사람이 고를 만한 갈래로 묶습니다 */
export const GROUPS = [
  ["all",   "전체"],
  ["image", "그림"],
  ["pdf",   "PDF"],
  ["sheet", "표"],
  ["doc",   "문서"],
];

/** notes-files.js 의 kind() 값 → 위 묶음 */
export function groupOf(type) {
  const t = String(type || "");
  if (t === "image") return "image";
  if (t === "pdf") return "pdf";
  if (t === "excel" || t === "csv") return "sheet";
  return "doc";
}

const GROUP_NAME = Object.fromEntries(GROUPS.map(([k, v]) => [k, v]));

/** 보기 좋은 크기 (notes-files.js 와 같은 규칙) */
export const niceSize = (n) =>
  !n ? "" :
  n >= 1048576 ? (n / 1048576).toFixed(1) + "MB"
  : n >= 1024 ? Math.round(n / 1024) + "KB" : n + "B";

/** 글 목록을 파일 목록으로 폅니다 — 파일 하나가 한 줄이 됩니다.
 *  자료는 Schedule·회의록·일상 등 **어느 게시판에서든** 올라옵니다.
 *  그래서 줄마다 「어디서 온 것인지」(cat·catLabel) 를 달아 둡니다.
 *  같은 파일이 두 글에 붙어 있으면 두 줄로 나옵니다 (어느 글의 것인지가 다릅니다).
 *  @param rows      notes 표에서 받아 온 글들
 *  @param catName   {schedule:"Schedule", …} — 갈래 이름표 (없어도 됩니다)
 *  @returns [{name,path,type,group,size,postId,postTitle,cat,catLabel,tag,date,place,event,people}]
 */
export function fileRows(rows, catName) {
  const nameOf = (k) => (catName && catName[k]) || k || "";
  const out = [];
  const seen = new Set();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const list = Array.isArray(r && r.files) ? r.files : [];
    list.forEach((f) => {
      if (!f || !f.path) return;
      const k = r.id + "|" + f.path;
      if (seen.has(k)) return;            // 같은 글에 같은 파일이 두 번 적혀 있으면 한 번만
      seen.add(k);
      out.push({
        name: String(f.name || "(이름 없음)"),
        path: String(f.path),
        type: String(f.type || "file"),
        group: groupOf(f.type),
        size: Number(f.size) || 0,
        postId: r.id,
        postTitle: String(r.title || "(제목 없음)"),
        cat: String(r.category || ""),
        catLabel: nameOf(r.category),
        tag: String(r.tag || ""),
        date: String(r.event_date || r.created_at || "").slice(0, 10),
        place: String(r.place || ""),
        event: String(r.event || ""),
        people: String(r.people || ""),
      });
    });
  });
  /* 새것부터 — 날짜가 같으면 파일 이름 차례로.
     날짜가 빈 것은 맨 뒤로 보냅니다 (언제 것인지 모르는 자료). */
  return out.sort((a, b) => {
    if (a.date !== b.date) {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? 1 : -1;
    }
    return a.name.localeCompare(b.name, "ko");
  });
}

/** 찾을 거리 한 줄 — 파일 이름과 그 글의 정보를 함께 봅니다.
    「강남」 을 치면 강남에서 만난 자리의 자료가, 「회의록」 을 치면
    회의록 게시판에서 올린 자료가 나옵니다. */
const hay = (x) => [
  x.name, x.postTitle, x.catLabel, x.tag, x.place, x.event, x.people, x.date,
].join(" ").toLowerCase();

/** 띄어 쓴 낱말을 모두 품은 것만 (notes.js 의 찾기와 같은 규칙) */
export function matchFile(x, query) {
  const s = String(query || "").trim().toLowerCase();
  if (!s) return true;
  const h = hay(x);
  return s.split(/\s+/).every((w) => h.includes(w));
}

/** 고른 묶음 · 게시판 · 찾는 말로 거릅니다.
    자료는 여러 게시판에서 올라오므로 「어느 게시판 것만」 도 골라 볼 수 있습니다. */
export function pickFiles(items, group, query, cat) {
  return (items || [])
    .filter((x) => !group || group === "all" || x.group === group)
    .filter((x) => !cat || cat === "all" || x.cat === cat)
    .filter((x) => matchFile(x, query));
}

/** 자료가 올라온 게시판들 — 많이 올라온 곳부터.
    같은 수면 **최근 자료가 있는 곳**을 앞에 둡니다
    (items 가 이미 새것부터 늘어서 있으므로, 처음 나온 차례를 그대로 씁니다).
    이름순으로 하면 「Schedule」 과 「회의록」 처럼 글자가 섞였을 때
    보는 사람이 짐작하기 어려운 차례가 됩니다.
    [{cat, label, n}] — 거르개 단추를 만드는 데 씁니다. */
export function byBoard(items) {
  const m = new Map();
  (items || []).forEach((x, i) => {
    const e = m.get(x.cat) || { cat: x.cat, label: x.catLabel || x.cat, n: 0, first: i };
    e.n++;
    m.set(x.cat, e);
  });
  return [...m.values()]
    .sort((a, b) => b.n - a.n || a.first - b.first)
    .map(({ cat, label, n }) => ({ cat, label, n }));
}

/** 묶음마다 몇 개인지 — 단추에 붙일 숫자입니다 */
export function counts(items) {
  const c = { all: 0 };
  GROUPS.forEach(([k]) => { if (k !== "all") c[k] = 0; });
  (items || []).forEach((x) => { c.all++; if (c[x.group] != null) c[x.group]++; });
  return c;
}

/** 「자료 12개 · 모두 34.5MB」 */
export function summary(items) {
  const n = (items || []).length;
  const bytes = (items || []).reduce((s, x) => s + (x.size || 0), 0);
  if (!n) return "자료 0개";
  return `자료 ${n}개` + (bytes ? ` · 모두 ${niceSize(bytes)}` : "");
}

/** 같은 파일이 여러 글에 붙어 있는가 — 알려 주면 지울 때 헷갈리지 않습니다 */
export function duplicates(items) {
  const by = new Map();
  (items || []).forEach((x) => {
    const l = by.get(x.path) || [];
    l.push(x);
    by.set(x.path, l);
  });
  return [...by.values()].filter((l) => l.length > 1);
}

export const groupName = (k) => GROUP_NAME[k] || k;
