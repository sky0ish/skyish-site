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
import * as GC from "./gcal.js?v=202608311900";

const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const CAT_COLOR = { schedule: "#4f9d92", diary: "#c98a3f" };

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));


export async function initHomeCal(id = "hocal") {
  const box = document.getElementById(id);
  if (!box) return;

  let user = null, me = null;
  try {
    user = await currentUser();
    me = user ? await myProfile().catch(() => null) : null;
  } catch (e) { /* 로그인 꾸러미가 안 열려도 첫 화면은 멀쩡해야 합니다 */ }

  const mail = ((user && user.email) || "").toLowerCase();
  const isAdmin = !!(me && me.is_admin) || OWNERS.indexOf(mail) >= 0;
  if (!isAdmin) { box.remove(); return; }

  let at = new Date(); at.setDate(1);          // 지금 보고 있는 달
  let notes = [], gEvents = [];

  box.hidden = false;
  box.innerHTML = '<p class="hocal__wait">달력을 여는 중…</p>';

  /* ── 내 글 가져오기 ── */
  try {
    const r = await sb.from("notes")
      .select("id,title,category,event_date,event_time,place")
      .in("category", ["schedule", "diary"])
      .not("event_date", "is", null)
      .order("event_date", { ascending: true });
    if (!r.error) notes = r.data || [];
  } catch (e) { /* 못 받아도 달력은 그립니다 */ }

  /* ── 구글 달력 — 이미 이어져 있을 때만 ── */
  async function pullG() {
    if (!GC.ready() || !GC.connected()) return;
    try { gEvents = await GC.month(at.getFullYear(), at.getMonth()) || []; }
    catch (e) { gEvents = []; }
  }
  await pullG();

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
      if (k) (byDay[k] ||= []).push({ t: n.title, c: CAT_COLOR[n.category] || "#4f9d92" });
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
        `<em title="${esc(x.t)}"><i style="background:${esc(x.c)}"></i>` +
        `<span>${esc(x.t)}</span></em>`).join("") +
        (list.length > 2 ? `<em class="more">+${list.length - 2}</em>` : "");
      cells += `<span class="hoc${out ? " out" : ""}${k === today ? " now" : ""}` +
        `${list.length ? " has" : ""}"${list.length ? ` title="${esc(list.map((x) => x.t).join(" · "))}"` : ""}>` +
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
            `<a href="blog.html?cat=schedule"><i style="background:${esc(s.c)}"></i>` +
            `<span class="d">${esc(s.k.slice(5).replace("-", "."))}</span>` +
            `<span class="t">${esc(s.t)}</span></a>`).join("") + "</div>"
        : '<p class="hocal__none">앞으로 잡힌 일정이 없습니다.</p>') +
      '<a class="hocal__more" href="blog.html?cat=schedule">일정 전체 보기 →</a>';

    box.querySelectorAll("[data-go]").forEach((b) =>
      b.addEventListener("click", async () => {
        at.setMonth(at.getMonth() + Number(b.dataset.go));
        await pullG();
        draw();
      }));
  }

  draw();
}
