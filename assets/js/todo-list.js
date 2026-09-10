// ─── 해야할일 — 차례 셈 ───────────────────────────────────
//
//  「체크리스트로 오늘 해야할일 확인하고 싶어. 곧 해야할일 추가하고,
//    하나씩 완료되면 중간에 줄그어서 아래로 내리게 해주고,
//    중요한걸 별표로 위로 올리게 하는 기능도. 항목별로 기입하고, 삭제, 편집 가능하게」
//
//  줄 하나 = { id, text, done, star, due, done_at, created_at }
//    · 별표(star) 는 맨 위로,  완료(done) 는 맨 아래로 (줄을 긋습니다)
//    · 그 안에서는 마감(due)이 가까운 것 → 먼저 적은 것 차례
//    · 완료된 것은 방금 끝낸 것이 완료 묶음의 맨 위에 옵니다 — 「아래로 내려가되」 바로 보이게
//
//  화면이 없는 셈 모듈입니다 — node 나 브라우저 시험 페이지에서 시험합니다 (tools/test/todo.mjs).

const at = (v) => { const t = Date.parse(v || ""); return isNaN(t) ? 0 : t; };

/** 「2026-09-10」 — 오늘 (셈에서는 넘겨받은 값을 씁니다) */
export function ymd(d) {
  const x = d instanceof Date ? d : new Date();
  const p = (n) => String(n).padStart(2, "0");
  return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate());
}

/** 마감 상태 — "late"(지남) · "today"(오늘) · "soon"(사흘 안) · "later" · ""(마감 없음) */
export function dueState(item, today) {
  const d = String((item && item.due) || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const t = String(today || ymd());
  if (d < t) return "late";
  if (d === t) return "today";
  const gap = (at(d) - at(t)) / 86400000;
  return gap <= 3 ? "soon" : "later";
}

/** 마감을 사람 말로 — 「오늘」 「지남 · 9.8」 「9.12(토)」 */
export function dueLabel(item, today) {
  const s = dueState(item, today);
  if (!s) return "";
  const d = String(item.due).slice(0, 10);
  const [y, m, dd] = d.split("-").map(Number);
  const W = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, dd).getDay()];
  const short = m + "." + dd + "(" + W + ")";
  if (s === "today") return "오늘";
  if (s === "late") return "지남 · " + short;
  return short;
}

/** 보이는 차례 — 별표 → 보통 → 완료(줄 그은 것) */
export function sortItems(items, today) {
  const L = (Array.isArray(items) ? items : []).filter((x) => x && x.id);
  const t = String(today || ymd());
  const rank = (x) => (x.done ? 2 : x.star ? 0 : 1);
  const dueKey = (x) => {
    const d = String(x.due || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "9999-99-99";      // 마감 없는 것은 뒤로
  };
  /* 손으로 정한 차례(sort)가 있으면 그것이 먼저입니다 — 「자유롭게 위아래 순서를 바꿀 수 있게」.
     없는 줄은 마감·적은 때 차례로 그 뒤에 섭니다. */
  const sv = (x) => (typeof x.sort === "number" && isFinite(x.sort) ? x.sort : Infinity);
  return L.slice().sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (a.done && b.done) return at(b.done_at) - at(a.done_at) || at(a.created_at) - at(b.created_at);
    const s = sv(a) - sv(b);
    if (s) return s;
    const d = dueKey(a).localeCompare(dueKey(b));
    if (d) return d;
    return at(a.created_at) - at(b.created_at);
  });
  /* t 는 지금은 쓰지 않지만, 「오늘 것만」 거를 때를 위해 받아 둡니다 */
}

/** 줄 하나를 위(-1)·아래(+1)로 한 칸, 또는 다른 줄 앞(beforeId)으로 옮깁니다.
 *  같은 묶음(별표끼리 · 보통끼리) 안에서만 움직입니다 — 별표는 늘 위, 완료는 늘 아래니까요.
 *  @returns 바뀐 줄들의 { id, sort } — 그 묶음 전체에 0,1,2… 를 다시 매겨 흔들리지 않게 합니다
 */
export function reorder(items, id, dir, today) {
  const all = sortItems(items, today);
  const me = all.find((x) => x.id === id);
  if (!me || me.done) return [];
  const group = all.filter((x) => !x.done && !!x.star === !!me.star);
  const ids = group.map((x) => x.id);
  const i = ids.indexOf(id);
  let j;
  if (typeof dir === "number") {
    j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= ids.length) return [];
  } else {
    /* dir 이 줄 id 면 「그 줄 앞으로」 — 빈 값이면 맨 아래로 */
    const k = dir ? ids.indexOf(String(dir)) : ids.length;
    if (k < 0 || k === i) return [];
    j = k > i ? k - 1 : k;
  }
  ids.splice(i, 1); ids.splice(j, 0, id);
  const out = [];
  ids.forEach((x, n) => {
    const it = group.find((g) => g.id === x);
    if (it.sort !== n) out.push({ id: x, sort: n });
  });
  return out;
}

/** 새 줄이 설 자리 — 그 묶음의 맨 아래 */
export function nextSort(items) {
  const L = (Array.isArray(items) ? items : []).filter((x) => x && !x.done);
  const m = L.reduce((n, x) => (typeof x.sort === "number" && x.sort > n ? x.sort : n), -1);
  return m + 1;
}

/** 남은 것 · 완료 · 별표 · 오늘 마감 셈 */
export function counts(items, today) {
  const L = (Array.isArray(items) ? items : []).filter(Boolean);
  const t = String(today || ymd());
  const open = L.filter((x) => !x.done);
  return {
    total: L.length,
    open: open.length,
    done: L.length - open.length,
    star: open.filter((x) => x.star).length,
    today: open.filter((x) => { const s = dueState(x, t); return s === "today" || s === "late"; }).length,
  };
}

/** 새 줄 — 글이 비면 null */
export function newItem(text, due, now) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const d = String(due || "").slice(0, 10);
  return {
    text: t.slice(0, 300),
    due: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
    done: false, star: false, done_at: null,
    created_at: now || new Date().toISOString(),
  };
}

/** 고친 값 — 완료를 켜면 done_at 을, 끄면 비웁니다. 빈 글은 받지 않습니다. */
export function patchFor(item, change, now) {
  const out = {};
  if (!item || !change) return out;
  if ("text" in change) {
    const t = String(change.text || "").replace(/\s+/g, " ").trim();
    if (t && t !== item.text) out.text = t.slice(0, 300);
  }
  if ("due" in change) {
    const d = String(change.due || "").slice(0, 10);
    out.due = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    if (out.due === (item.due || null)) delete out.due;
  }
  if ("star" in change && !!change.star !== !!item.star) out.star = !!change.star;
  if ("done" in change && !!change.done !== !!item.done) {
    out.done = !!change.done;
    out.done_at = out.done ? (now || new Date().toISOString()) : null;
  }
  return out;
}

/** 「9월 10일(수) 해야할일」 */
export function todayTitle(today) {
  const t = String(today || ymd());
  const [y, m, d] = t.split("-").map(Number);
  const W = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return m + "월 " + d + "일(" + W + ") 해야할일";
}
