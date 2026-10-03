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
import * as GC from "./gcal.js?v=202610031700";
import { dropMirrors } from "./cal-merge.js?v=202609010300";
import * as CO from "./cal-open.js?v=202609301200";

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
/* 지난번 그림을 되살릴 때 쓰는 열쇠 — 달마다 따로 둡니다.
   전에는 열쇠가 하나라, 8월을 보다 새로고침하면 9월 판에 8월 구글 일정이
   잠깐 얹혔습니다. */
const cacheKey = (y, m) => CACHE + ":" + y + "-" + pad(m + 1);

/* 한 칸에 몇 건까지 이름을 보여 줄지.
   전에는 2건이었습니다 — 그래서 구글 일정이 잘 들어와 있어도 화면에서는
   사라진 것처럼 보였습니다. 「전부 보이게」 가 기본이고, 아주 많은 날만
   접습니다. 「간단히」 로 바꾸면 예전처럼 2건만 보여 줍니다. */
const SHOWALL = "skyish-homecal-all";
const MANY = 12;              // 이보다 많은 날만 「+n」 으로 접습니다
const showAll = () => {
  try { return localStorage.getItem(SHOWALL) !== "0"; } catch (e) { return true; }
};
const setShowAll = (v) => {
  try { localStorage.setItem(SHOWALL, v ? "1" : "0"); } catch (e) {}
};

export async function initHomeCal(id = "hocal") {
  const box = document.getElementById(id);
  if (!box) return;
  /* 폰 앱인가 — 앱에서 들어간 글은 저장·취소를 마치면 앱 달력으로 되돌아옵니다 */
  const appMode = box.classList.contains("hocal--app");

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
  /* 구글 열쇠를 만료 전에 미리 새로 받아 두게 합니다 —
     한 번 이어 두었으면 손수 끊기 전까지 이어져 있게. */
  try { if (GC.keepAlive) GC.keepAlive(); } catch (e) {}

  /* ② 지난번에 받아 둔 것이 있으면 그것으로 곧바로 그립니다.
     자료가 새로 오면 조용히 갈아 끼웁니다. */
  let painted = false;
  try {
    const c = JSON.parse(sessionStorage.getItem(cacheKey(at.getFullYear(), at.getMonth())) || "null");
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
    /* tag 와 gcal_id 도 받아 옵니다 — 구글로 넘어간 사본을 걷어 내려면
       이 두 칸이 있어야 짝을 지을 수 있습니다.
       gcal_id 칸이 아직 없는 자료 쪽이면 그것만 빼고 다시 받습니다. */
    const ask = async (cols) => sb.from("notes")
      .select(cols)
      .in("category", ["schedule", "diary"])
      .gte("event_date", ymd(from))
      .lte("event_date", ymd(to))
      .order("event_date", { ascending: true });
    try {
      let r = await ask("id,title,category,event_date,tag,gcal_id");
      if (r.error) r = await ask("id,title,category,event_date,tag");
      if (r.error) r = await ask("id,title,category,event_date");
      if (!r.error) notes = r.data || [];
    } catch (e) { /* 못 받아도 달력은 그립니다 */ }
  }

  let gErr = "";                 // 구글에서 통째로 못 받아 왔을 때의 까닭
  async function pullG(soft) {
    if (!GC.ready()) return;
    const y0 = at.getFullYear(), m0 = at.getMonth();   // 받는 사이 달을 넘기면 버립니다
    /* 열쇠가 만료됐어도 전에 이어 두었다면 창 없이 조용히 다시 받아 옵니다 */
    if (!GC.connected() && GC.silent) { try { await GC.silent(); } catch (e) {} }
    /* 아직 안 이어졌으면 아래 「구글 달력 잇기」 단추가 말해 줍니다 — 겹쳐 말하지 않습니다 */
    if (!GC.connected()) { gErr = ""; return; }
    try {
      const got = await GC.month(y0, m0) || [];
      if (y0 !== at.getFullYear() || m0 !== at.getMonth()) return;   // 그새 다른 달로 갔습니다
      gEvents = got;
      gErr = "";
    } catch (e) {
      if (y0 !== at.getFullYear() || m0 !== at.getMonth()) return;
      /* 저절로 새로 받다가 잠깐 실패한 것이면 보이던 일정을 그대로 둡니다 */
      if (soft) return;
      /* 전에는 말없이 비웠습니다 — 그래서 「일정이 빠졌다」 로만 보였습니다 */
      gEvents = [];
      gErr = (e && e.message) || "구글에서 받아 오지 못했습니다";
    }
  }

  /** 지금 판을 지난번 그림으로 적어 둡니다 (달마다 따로) */
  function keep() {
    try {
      sessionStorage.setItem(cacheKey(at.getFullYear(), at.getMonth()),
                             JSON.stringify({ notes, g: gEvents }));
    } catch (e) { /* 저장소가 꽉 차도 그냥 갑니다 */ }
  }

  await Promise.all([loadNotes(), pullG()]);
  keep();

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

  /* 일정 하나가 어디로 이어질지 — 규칙은 cal-open.js 에 있습니다.
     내가 쓴 글이면 그 글의 고치기 창으로, 구글에서 온 것이면 그날 새 일정 창으로
     (제목·시각을 실어 보내 미리 채웁니다). */
  const linkTo = (x, day) => CO.linkTo(x, day, appMode);

  /* ── 그리기 ── */
  function draw() {
    const y = at.getFullYear(), m = at.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const today = iso(new Date());
    const all = showAll();

    // 날짜별로 모읍니다
    const byDay = {};
    notes.forEach((n) => {
      const k = (n.event_date || "").slice(0, 10);
      if (k) (byDay[k] ||= []).push({
        t: n.title, c: CAT_COLOR[n.category] || "#4f9d92",
        id: n.id, cat: n.category,   // 눌렀을 때 그 글로 갑니다
      });
    });
    /* 내가 여기서 쓴 글이 구글로 넘어간 것은 걷어 냅니다 —
       안 걷으면 한 건이 달력에 두 번 뜹니다. */
    dropMirrors(notes, gEvents).forEach((e) => {
      (byDay[e.date] ||= []).push({ t: e.title, c: e.color || "#4285f4", g: 1,
                                    time: e.time, place: e.place,
                                    // 며칠에 걸친 일정의 둘째 날부터인가 · 어느 캘린더인가
                                    nth: e.nth || 0, span: e.span || 1, cal: e.cal,
                                    gid: e.gid, calId: e.calId });
    });
    // 시각이 있는 것을 앞으로, 그 다음 종일 — 칸 안이 뒤섞이지 않게
    Object.keys(byDay).forEach((k) => byDay[k].sort((a, b) =>
      (a.time || "99:99").localeCompare(b.time || "99:99")));

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = iso(d);
      const out = d.getMonth() !== m;
      const list = byDay[k] || [];
      /* 그날 일정을 「전부」 보여 줍니다.
         전에는 두 건에서 잘랐습니다 — 구글에서 잘 받아 온 일정도 세 번째부터는
         화면에서 사라져, 「홈페이지에 일정이 빠졌다」 로 보였습니다.
         아주 많은 날(12건 초과)만 접고, 「간단히」 를 고르면 예전처럼 2건만. */
      const cap = all ? MANY : 2;
      const items = list.slice(0, cap).map((x) =>
        `<a class="hev${x.nth ? " cont" : ""}" href="${esc(linkTo(x, k))}" ` +
        `title="${esc(x.t)}${x.time ? " · " + esc(x.time) : ""}${x.cal ? " · " + esc(x.cal) : ""}">` +
        `<i style="background:${esc(x.c)}"></i>` +
        `<span>${esc(x.t)}</span></a>`).join("") +
        (list.length > cap
          ? `<em class="more" data-more="${k}" title="이날 일정 모두 보기">+${list.length - cap}</em>`
          : "");
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

    /* 구글에서 무엇을 받아 왔는지 — 빠진 캘린더가 있으면 말해 줍니다.
       전에는 캘린더 하나가 통째로 막혀도 화면에는 아무 말이 없어서,
       「왜 빠졌는지」 를 알 길이 없었습니다. */
    const rep = (GC.lastReport ? GC.lastReport() : null) || { cals: [], failed: [] };
    const note =
      (gErr
        ? '<p class="hocal__warn">⚠ 구글 일정을 못 받았습니다 — ' + esc(gErr) + '</p>'
        : "") +
      (rep.failed && rep.failed.length
        ? '<p class="hocal__warn" title="' +
            esc(rep.failed.map((f) => f.name + " — " + f.why).join(" / ")) +
          '">⚠ 구글 캘린더 ' + rep.failed.length + '개를 못 읽었습니다 — 눌러서 다시 받기</p>'
        : "") +
      (GC.connected && GC.connected() && rep.when
        ? '<p class="hocal__stat" id="hocalStat" title="' +
            esc(rep.cals.map((c) => c.name + " " + c.count + "건").join(" / ")) +
          '">구글 캘린더 ' + rep.cals.length + '개 · 이 판 ' + (rep.events || 0) + '건</p>'
        : "");

    box.innerHTML =
      '<div class="hocal__head">' +
        '<button type="button" class="hocal__nav" data-go="-1" aria-label="지난달">‹</button>' +
        `<b>${y}. ${pad(m + 1)}</b>` +
        '<button type="button" class="hocal__nav hocal__all" id="hocalAll" ' +
          `title="${all ? "한 칸에 두 건만 보이게" : "그날 일정을 모두 보이게"}">` +
          (all ? "간단히" : "모두") + "</button>" +
        '<button type="button" class="hocal__nav" data-go="1" aria-label="다음달">›</button>' +
      "</div>" +
      '<div class="hocal__wd">' + WEEK.map((w, i) =>
        `<span class="${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</span>`).join("") + "</div>" +
      '<div class="hocal__grid">' + cells + "</div>" +
      (soon.length
        ? '<div class="hocal__soon">' + soon.map((s) =>
            `<a href="${esc(linkTo(s, s.k))}"><i style="background:${esc(s.c)}"></i>` +
            `<span class="d">${esc(s.k.slice(5).replace("-", "."))}</span>` +
            `<span class="t">${esc(s.t)}</span></a>`).join("") + "</div>"
        : '<p class="hocal__none">앞으로 잡힌 일정이 없습니다.</p>') +
      /* 이어져 있지 않으면 늘 잇는 단추를 놓습니다.
         전에는 「한 번이라도 이었으면」 숨겼는데, 조용히 잇기가 실패하면
         (구글에서 로그아웃·허락 취소·다른 브라우저) 다시 이을 길이 없었습니다.
         구글 창은 사람이 누른 순간에만 뜰 수 있어, 스스로 열지 못합니다. */
      (GC.ready() && !(GC.linked ? GC.linked() : GC.connected())
        ? '<button type="button" class="hocal__gc" id="hocalGc">'
          + (GC.everLinked && GC.everLinked()
              ? "🔗 구글 달력 다시 잇기 — 연결이 풀렸습니다"
              : "🔗 구글 달력 잇기 — 구글 일정도 함께 보입니다")
          + "</button>"
        : "") +
      note +
      (GC.serverMode && GC.serverMode() && GC.serverLinked && GC.serverLinked() === false &&
       GC.connected && GC.connected()
        ? '<button type="button" class="hocal__gc" id="hocalKeep">' +
          "🔒 늘 연결 켜기 — 한 번 누르면 앞으로 구글 창 없이 계속 이어집니다</button>"
        : "") +
      '<a class="hocal__more" href="blog.html?cat=schedule">일정 전체 보기 →</a>';

    /* 「모두 / 간단히」 — 고른 것은 이 브라우저에 남습니다 */
    const allBtn = document.getElementById("hocalAll");
    if (allBtn) allBtn.addEventListener("click", () => { setShowAll(!all); draw(); });

    /* 못 읽은 캘린더가 있으면 눌러서 다시 — 구글이 잠깐 막았을 때가 많습니다 */
    const warn = box.querySelector(".hocal__warn");
    if (warn) warn.addEventListener("click", async () => {
      warn.textContent = "다시 받는 중…";
      await pullG();
      keep();
      draw();
    });

    /* 「🔒 늘 연결 켜기」 — 지금은 이어져 있지만 서버에 갱신 열쇠가 아직 없을 때.
       한 번 누르면 그 뒤로는 창 없이 이어집니다 (폰·PC 어디서나). */
    const keepBtn = document.getElementById("hocalKeep");
    if (keepBtn) keepBtn.addEventListener("click", async () => {
      keepBtn.disabled = true;
      keepBtn.textContent = "구글에 묻는 중…";
      try {
        await GC.connect(false, { server: true });
        draw();
      } catch (e) {
        keepBtn.disabled = false;
        keepBtn.textContent = (e && e.message) || "잇지 못했습니다 — 다시 눌러 주세요";
      }
    });

    const gcBtn = document.getElementById("hocalGc");
    if (gcBtn && GC.warm) GC.warm();        // 누르기 전에 미리 데워 둡니다
    if (gcBtn) gcBtn.addEventListener("click", async () => {
      gcBtn.disabled = true;
      gcBtn.textContent = "구글에 묻는 중…";
      try {
        await GC.connect();               // 여기서 구글 창이 뜹니다
        await pullG();
        keep();
        draw();
      } catch (e) {
        gcBtn.disabled = false;
        gcBtn.textContent = "잇지 못했습니다 — 다시 눌러 주세요";
      }
    });

    /* 날짜를 누르면 「그날 무엇을 쓸지」 고르개가 뜹니다 */
    const grid = box.querySelector(".hocal__grid");

    /** 그날 일정을 크게 펼칩니다 — 고르면 그 글의 「고치기」 창으로 갑니다.
     *  구글에서 온 일정은 아직 내 글이 아니므로 「글로 옮기기」 로,
     *  그날 새 일정 창이 제목·시각까지 채워진 채 열립니다.
     *  달력 칸 안이 아니라 화면 한가운데에 큼직하게 띄웁니다 — 칸 안에 넣으면
     *  폰에서는 손가락보다 작아 고를 수가 없습니다. */
    function showDay(day) {
      document.querySelectorAll(".hoday").forEach((x) => x.remove());
      const list = byDay[day] || [];
      const sheet = document.createElement("div");
      sheet.className = "hoday" + (appMode ? " hoday--app" : "");
      sheet.innerHTML =
        '<div class="hoday__box" role="dialog" aria-label="그날 일정">' +
          '<b class="hoday__h">' + esc(CO.dayLabel(day)) + " · " + list.length + "건</b>" +
          '<div class="hoday__list">' +
          list.map((x) =>
            '<a class="hoday__i" href="' + esc(linkTo(x, day)) + '">' +
              '<i style="background:' + esc(x.c) + '"></i>' +
              (x.time ? '<em>' + esc(x.time) + "</em>" : "") +
              "<span>" + esc(x.t) + "</span>" +
              '<small>' + (x.id ? "고치기" : "글로 옮기기") + "</small>" +
            "</a>").join("") +
          "</div>" +
          '<div class="hoday__new">' +
            '<a href="' + esc(CO.newLink("diary", day, appMode)) + '">✎ 일기</a>' +
            '<a href="' + esc(CO.newLink("schedule", day, appMode)) + '">📅 일정</a>' +
            '<button type="button" class="hoday__x">닫기</button>' +
          "</div>" +
        "</div>";
      document.body.appendChild(sheet);
      const shut = () => {
        sheet.remove();
        document.removeEventListener("keydown", esckey, true);
      };
      const esckey = (ev) => { if (ev.key === "Escape") shut(); };
      /* 바깥이나 「닫기」 를 누르면 닫습니다. 항목은 제 길로 갑니다. */
      sheet.addEventListener("click", (ev) => {
        if (ev.target === sheet || ev.target.closest(".hoday__x")) { ev.preventDefault(); shut(); }
      });
      document.addEventListener("keydown", esckey, true);
    }

    /* 날짜 칸을 눌렀을 때 —
         일정이 여럿이면  → 먼저 크게 펼쳐 고르게 합니다 (한 단계 더)
         하나뿐이면       → 곧바로 그 글의 고치기 창으로
         하나도 없으면    → 새로 씁니다
       폰 앱(.hocal--app)에서 아무것도 없는 날은 칸을 위아래로 나눕니다.
       손가락이 굵어도 어긋나지 않게 —
         위 (숫자 쪽, 칸의 45%·최소 34px) → 그날 Diary
         아래 (글자 쪽)                   → 그날 Schedule */
    if (grid) grid.addEventListener("click", (e) => {
      // 고르개 창 안의 항목은 제 길로 갑니다 — 칸 나누기가 가로채면 안 됩니다
      if (e.target.closest(".hopick") || e.target.closest(".hoday")) return;
      const cell = e.target.closest(".hoc");
      if (!cell || !cell.dataset.d) return;
      const day = cell.dataset.d;
      const list = byDay[day] || [];

      // 「+n」 은 어느 화면에서든 「그날 다 보기」 가 먼저입니다
      if (e.target.closest(".more")) { e.preventDefault(); showDay(day); return; }

      /* 넓은 화면에서 일정 글줄을 곧바로 누른 것은 그 글로 — 제 길이 있습니다.
         폰에서는 글줄이 손가락보다 작아, 아래 규칙을 따릅니다. */
      if (!appMode && e.target.closest(".hev")) return;

      const act = CO.dayAction(list);
      if (act === "many") { e.preventDefault(); showDay(day); return; }
      if (act === "one") { e.preventDefault(); location.href = linkTo(list[0], day); return; }

      // 아무 일정도 없는 날 — 새로 씁니다
      if (appMode) {
        e.preventDefault();                          // 일정 글줄의 제 길로 가지 않게
        const r = cell.getBoundingClientRect();
        const diary = e.clientY < r.top + Math.max(34, r.height * 0.45);
        // back=app — 저장·취소를 마치면 앱 달력으로 되돌아오라는 표시입니다
        location.href = CO.newLink(diary ? "diary" : "schedule", day, true);
        return;
      }
      // 날짜 숫자를 누르면 곧바로 Diary 로 — 그날의 글을 적는 것이 가장 잦습니다
      if (e.target.closest("b")) { location.href = CO.newLink("diary", day, false); return; }
      // 칸의 빈 곳을 누르면 다른 게시판도 고를 수 있습니다
      pick(cell, day);
    });

    box.querySelectorAll("[data-go]").forEach((b) =>
      b.addEventListener("click", async () => {
        at.setMonth(at.getMonth() + Number(b.dataset.go));
        /* 넘어간 달에 지난번 그림이 있으면 먼저 그려 둡니다 — 기다림이 안 보이게 */
        try {
          const c = JSON.parse(sessionStorage.getItem(cacheKey(at.getFullYear(), at.getMonth())) || "null");
          if (c && Array.isArray(c.g)) { gEvents = c.g; draw(); }
        } catch (e) {}
        await pullG();
        keep();
        draw();
      }));
  }

  draw();

  /* 서버(갱신 열쇠 보관함)를 살펴보고, 아직 맡기지 않았으면 「늘 연결 켜기」 단추를 띄웁니다 */
  if (GC.probeServer) {
    GC.probeServer().then(() => {
      if (GC.serverMode() && GC.serverLinked() === false) { GC.warm && GC.warm(); draw(); }
    }).catch(() => {});
  }

  /* ── 저절로 새로 받기 ──
     「캘린더 스케쥴이 항상 자동으로 …」 — 열어 둔 채로 있어도 구글·게시판에서
     바뀐 일정이 들어오게 합니다.
     · 화면이 보이는 동안 5분마다
     · 다른 앱·탭에 갔다가 돌아왔을 때 (1분 넘게 지났으면)
     바뀐 것이 없으면 다시 그리지 않고, 「어느 게시판에 쓸지」 창이 열려 있으면
     닫히지 않게 다음 차례로 미룹니다. */
  const EVERY = 5 * 60 * 1000, AGAIN = 60 * 1000;
  let lastPull = Date.now(), pulling = false;
  const sig = () => JSON.stringify([notes, gEvents, gErr]);
  async function refresh() {
    if (pulling || !document.body.contains(box)) return;
    if (document.visibilityState === "hidden") return;
    pulling = true;
    try {
      const before = sig();
      await Promise.all([loadNotes(), pullG(true)]);
      lastPull = Date.now();
      if (sig() === before) return;                  // 바뀐 것 없음
      keep();
      if (box.querySelector(".hopick")) return;      // 고르는 중 — 다음 차례에
      draw();
    } finally { pulling = false; }
  }
  setInterval(refresh, EVERY);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastPull > AGAIN) refresh();
  });
  window.addEventListener("focus", () => {
    if (Date.now() - lastPull > AGAIN) refresh();
  });
}
