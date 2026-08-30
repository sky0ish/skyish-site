// ─── 첫 화면의 달력 ────────────────────────────────────────
//
//  관리자로 들어왔을 때만 첫 화면 오른쪽에 이번 달 달력을 폅니다.
//  그 밖의 분에게는 아예 없는 것처럼 사라집니다 (자리도 안 남깁니다).
//
//  얹는 것
//    · My WAY… 의 Schedule · Diary 글 (event_date 가 있는 것)
//    · 구글 달력 — 이미 이어져 있을 때만 조용히 가져옵니다.
//      아직 이어지지 않았으면 부르지 않습니다. 사람이 누르지 않은 자리에서
//      구글 창을 띄우면 브라우저가 막고 「Failed to open popup window」 가 뜹니다.
import { sb, currentUser, myProfile } from "../../auth/auth.js";
import * as GC from "./gcal.js?v=202609011300";

const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const CAT_COLOR = { schedule: "#4f9d92", diary: "#c98a3f" };

/* 날짜를 눌렀을 때 고를 수 있는 게시판.
   notes.js 와 같은 값입니다 — 그 쪽을 불러오면 첫 화면이 무거워져 따로 적어 둡니다. */
const WRITE_CATS = [
  ["diary", "Diary"], ["schedule", "Schedule"], ["minutes", "회의록"],
  ["daily", "일상"], ["etc", "ETC"],
];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));


/* 브라우저에 남아 있는 로그인 흔적만 보고 곧바로 판단합니다.
   Supabase 에 물어보면 왕복이 한 번 더 생겨 첫 그림이 늦습니다. */
function storedMail() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/skyish-auth|^sb-.*-auth-token$/.test(k)) continue;
      const v = JSON.parse(localStorage.getItem(k) || "null");
      const u = v && (v.user || (v.currentSession && v.currentSession.user));
      if (u && u.email) return String(u.email).toLowerCase();
    }
  } catch (e) {}
  return "";
}

const CACHE = "skyish-homecal";

export async function initHomeCal(id = "hocal") {
  const box = document.getElementById(id);
  if (!box) return;

  /* ① 저장소만 보고 먼저 가릅니다 — 네트워크를 기다리지 않습니다 */
  const mail = storedMail();
  if (!mail) { box.remove(); return; }
  if (OWNERS.indexOf(mail) < 0) {
    // 주인 메일이 아니면 그때 가서 제대로 확인합니다 (드문 길)
    let me = null;
    try { me = await myProfile().catch(() => null); } catch (e) {}
    if (!(me && me.is_admin)) { box.remove(); return; }
  }

  let at = new Date(); at.setDate(1);          // 지금 보고 있는 달
  let notes = [], gEvents = [];

  box.hidden = false;

  /* ② 지난번에 받아 둔 것이 있으면 그것으로 곧바로 그립니다.
     자료가 새로 오면 조용히 갈아 끼웁니다. */
  let painted = false;
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE) || "null");
    if (c && Array.isArray(c.notes)) {
      notes = c.notes;
      gEvents = Array.isArray(c.g) ? c.g : [];
      draw();
      painted = true;
    }
  } catch (e) {}
  if (!painted) box.innerHTML = '<p class="hocal__wait">달력을 여는 중…</p>';

  /* ③ 새 자료는 한꺼번에 (줄줄이 기다리지 않습니다) */
  async function loadNotes() {
    // 지난 석 달부터 앞으로 한 해까지만 봅니다 — 전부 끌어오면 느립니다
    const from = new Date(); from.setMonth(from.getMonth() - 3);
    const to = new Date(); to.setFullYear(to.getFullYear() + 1);
    const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    try {
      const r = await sb.from("notes")
        .select("id,title,category,event_date")
        .in("category", ["schedule", "diary"])
        .gte("event_date", ymd(from))
        .lte("event_date", ymd(to))
        .order("event_date", { ascending: true });
      if (!r.error) notes = r.data || [];
    } catch (e) { /* 못 받아도 달력은 그립니다 */ }
  }

  async function pullG() {
    if (!GC.ready() || !GC.connected()) return;
    try { gEvents = await GC.month(at.getFullYear(), at.getMonth()) || []; }
    catch (e) { gEvents = []; }
  }

  await Promise.all([loadNotes(), pullG()]);
  try {
    sessionStorage.setItem(CACHE, JSON.stringify({ notes, g: gEvents }));
  } catch (e) { /* 저장소가 꽉 차도 그냥 갑니다 */ }

  /** 그날 어느 게시판에 쓸지 고르는 작은 창 */
  function pick(cell, day) {
    document.querySelectorAll(".hopick").forEach((x) => x.remove());
    const p = document.createElement("div");
    p.className = "hopick";
    p.innerHTML = `<b>${day.replace(/-/g, ".")} 에 쓰기</b>` +
      WRITE_CATS.map(([k, v]) =>
        `<a href="blog.html?cat=${k}&new=${day}">${esc(v)}</a>`).join("");
    cell.appendChild(p);

    // 바깥을 누르면 닫습니다
    const shut = (ev) => {
      if (p.contains(ev.target)) return;
      p.remove();
      document.removeEventListener("click", shut, true);
    };
    setTimeout(() => document.addEventListener("click", shut, true), 0);
  }

  /* 일정 하나가 어디로 이어질지 —
     내가 쓴 글이면 그 글로, 구글에서 온 것이면 일정 게시판으로. */
  function linkTo(x) {
    if (x.id) return `blog.html?cat=${x.cat === "diary" ? "diary" : "schedule"}&id=${x.id}`;
    return "blog.html?cat=schedule";
  }

  /* ── 그리기 ── */
  function draw() {
    const y = at.getFullYear(), m = at.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const today = iso(new Date());

    // 날짜별로 모읍니다
    const byDay = {};
    notes.forEach((n) => {
      const k = (n.event_date || "").slice(0, 10);
      if (k) (byDay[k] ||= []).push({
        t: n.title, c: CAT_COLOR[n.category] || "#4f9d92",
        id: n.id, cat: n.category,   // 눌렀을 때 그 글로 갑니다
      });
    });
    gEvents.forEach((e) => {
      (byDay[e.date] ||= []).push({ t: e.title, c: e.color || "#4285f4", g: 1, time: e.time });
    });

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = iso(d);
      const out = d.getMonth() !== m;
      const list = byDay[k] || [];
      // 두 건까지는 이름을 보여 주고, 더 있으면 「+n」 으로 줄입니다
      const items = list.slice(0, 2).map((x) =>
        `<a class="hev" href="${esc(linkTo(x))}" title="${esc(x.t)}">` +
        `<i style="background:${esc(x.c)}"></i>` +
        `<span>${esc(x.t)}</span></a>`).join("") +
        (list.length > 2 ? `<em class="more">+${list.length - 2}</em>` : "");
      cells += `<span class="hoc${out ? " out" : ""}${k === today ? " now" : ""}` +
        `${list.length ? " has" : ""}" data-d="${k}"` +
        `${list.length ? ` title="${esc(list.map((x) => x.t).join(" · "))}"` : ""}>` +
        `<b class="${d.getDay() === 0 ? "sun" : d.getDay() === 6 ? "sat" : ""}">${d.getDate()}</b>` +
        items + "</span>";
    }

    // 오늘부터 다가오는 일정 넷
    const soon = Object.keys(byDay).filter((k) => k >= today).sort().slice(0, 6)
      .flatMap((k) => byDay[k].map((x) => ({ ...x, k })))
      .slice(0, 4);

    box.innerHTML =
      '<div class="hocal__head">' +
        '<button type="button" class="hocal__nav" data-go="-1" aria-label="지난달">‹</button>' +
        `<b>${y}. ${pad(m + 1)}</b>` +
        '<button type="button" class="hocal__nav" data-go="1" aria-label="다음달">›</button>' +
      "</div>" +
      '<div class="hocal__wd">' + WEEK.map((w, i) =>
        `<span class="${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</span>`).join("") + "</div>" +
      '<div class="hocal__grid">' + cells + "</div>" +
      (soon.length
        ? '<div class="hocal__soon">' + soon.map((s) =>
            `<a href="${esc(linkTo(s))}"><i style="background:${esc(s.c)}"></i>` +
            `<span class="d">${esc(s.k.slice(5).replace("-", "."))}</span>` +
            `<span class="t">${esc(s.t)}</span></a>`).join("") + "</div>"
        : '<p class="hocal__none">앞으로 잡힌 일정이 없습니다.</p>') +
      '<a class="hocal__more" href="blog.html?cat=schedule">일정 전체 보기 →</a>';

    /* 날짜를 누르면 「그날 무엇을 쓸지」 고르개가 뜹니다 */
    const grid = box.querySelector(".hocal__grid");
    if (grid) grid.addEventListener("click", (e) => {
      if (e.target.closest(".hev")) return;          // 일정을 누른 것은 그 글로 갑니다
      const cell = e.target.closest(".hoc");
      if (!cell || !cell.dataset.d) return;
      // 날짜 숫자를 누르면 곧바로 Diary 로 — 그날의 글을 적는 것이 가장 잦습니다
      if (e.target.closest("b")) {
        location.href = "blog.html?cat=diary&new=" + cell.dataset.d;
        return;
      }
      // 칸의 빈 곳을 누르면 다른 게시판도 고를 수 있습니다
      pick(cell, cell.dataset.d);
    });

    box.querySelectorAll("[data-go]").forEach((b) =>
      b.addEventListener("click", async () => {
        at.setMonth(at.getMonth() + Number(b.dataset.go));
        await pullG();
        draw();
      }));
  }

  draw();
}
