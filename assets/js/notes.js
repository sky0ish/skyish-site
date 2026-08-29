// ─── BLOG — My Road… (나만 보는 기록) ────────────────────
// Schedule · Diary · 연락망 · 사람들 · 회의록 다섯 갈래.
// 글에 적힌 날짜를 알아채어 달력에 얹고, 엑셀로 내려받을 수 있습니다.
// 관리자만 보고 쓸 수 있습니다 (자료 쪽 규칙 notes_setup.sql 이 실제로 막습니다).
import { sb, currentUser, myProfile } from "../../auth/auth.js";

export const CATS = [
  ["schedule", "Schedule", "#4f9d92"],
  ["diary",    "Diary",    "#c8925a"],
  ["contacts", "연락망",   "#2a5fa8"],
  ["people",   "사람들",   "#8a6bb0"],
  ["minutes",  "회의록",   "#b3543b"],
  ["daily",    "일상",     "#5c9e4a"],
  ["etc",      "ETC",      "#7d7768"],
];

/** 일반회원에게 열어 주는 갈래 — 「일상」만 봅니다 */
export const MEMBER_CATS = ["daily"];
export const CAT_NAME  = Object.fromEntries(CATS.map(([k, v]) => [k, v]));

/** 주인 이메일 — 회원 정보 줄이 없어도 관리자로 봅니다 */
export const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];

/** 끌어올 구글 캘린더 — 이 계정으로 크롬에 로그인돼 있어야 보입니다 */
export const GCAL = "whlove@gmail.com";

/** 회의록 말머리 — 회의록 갈래에서만 씁니다 */
export const TAGS = ["GRI", "도시일반", "건축일반", "주거", "균형발전", "산업", "일상", "ETC"];
export const CAT_COLOR = Object.fromEntries(CATS.map(([k, , c]) => [k, c]));

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymd = (s) => (s || "").toString().slice(0, 10).replace(/-/g, ".");

/* ── 글에서 날짜 찾아내기 ────────────────────────────────────
   2026.09.14 · 2026-9-14 · 2026/9/14 · 26.9.14 · 9월 14일 · 9/14
   여러 개가 있으면 맨 앞의 것을 씁니다. 연도가 없으면 올해로 봅니다. */
export function findDate(text, today) {
  const s = String(text || "");
  const now = today || new Date();
  const mk = (y, m, d) => {
    y = +y; m = +m; d = +d;
    if (y < 100) y += 2000;
    if (!y || y < 1900 || y > 2200) return null;
    if (!m || m < 1 || m > 12) return null;
    if (!d || d < 1 || d > 31) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };
  let m;
  // 연도.월.일
  m = s.match(/(\d{4}|\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/);
  if (m) { const r = mk(m[1], m[2], m[3]); if (r) return r; }
  // 월 일 (연도 없음) — 올해로 봅니다
  m = s.match(/(\d{1,2})\s*[월/]\s*(\d{1,2})\s*일?/);
  if (m) { const r = mk(now.getFullYear(), m[1], m[2]); if (r) return r; }
  // 20260914
  m = s.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (m) { const r = mk(m[1], m[2], m[3]); if (r) return r; }
  return null;
}

/* ── 글에서 장소·사람 찾아내기 ──
   「장소: 세운상가」 「@세운상가」 「사람: 김철수, 이영희」 처럼 적으면 알아챕니다 */
export function findField(text, keys) {
  const s = String(text || "");
  for (const k of keys) {
    const m = s.match(new RegExp(k + "\\s*[:：]\\s*([^\\n]+)"));
    if (m) return m[1].trim().slice(0, 200);
  }
  return "";
}

function friendly(m) {
  m = String(m || "");
  if (/schema cache|does not exist|relation/i.test(m))
    return "기록이 아직 켜지지 않았습니다 — auth/notes_setup.sql 을 한 번 실행해주세요.";
  if (/row-level security|policy|permission/i.test(m))
    return "권한이 없습니다. 관리자만 쓸 수 있습니다.";
  return m;
}

/* ── 엑셀로 내려받기 ──
   CSV 앞에 BOM 을 붙이면 엑셀에서 한글이 깨지지 않습니다. */
function toCSV(rows) {
  const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const head = ["날짜", "갈래", "말머리", "이벤트", "장소", "만난 사람", "내용", "적은 때"];
  const lines = [head.map(q).join(",")];
  rows.forEach((r) => lines.push([
    ymd(r.event_date), CAT_NAME[r.category] || r.category, r.tag || "",
    r.title, r.place, r.people,
    (r.body || "").replace(/\r?\n/g, " "), ymd(r.created_at),
  ].map(q).join(",")));
  return "﻿" + lines.join("\r\n");
}
function download(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ══════════════════════════════════════════════════════════ */
export async function initNotes(mountId = "notesapp") {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const user = await currentUser();
  const me = user ? await myProfile().catch(() => null) : null;
  const mail = ((user && user.email) || "").toLowerCase();
  const isAdmin  = !!(me && me.is_admin) || OWNERS.indexOf(mail) >= 0;
  const isMember = isAdmin || !!(me && me.analysis_access);

  if (!user) {
    mount.innerHTML =
      '<div class="nlocked"><h2>비공개 기록장입니다</h2>' +
      "<p>로그인하신 뒤 보실 수 있습니다.</p>" +
      '<p class="nlocked__sub"><a href="auth/login.html?next=%2Fblog.html">로그인 →</a></p></div>';
    return;
  }
  if (!isMember) {
    mount.innerHTML =
      '<div class="nlocked"><h2>승인을 기다리고 있습니다</h2>' +
      "<p>운영자가 승인하면 「일상」을 보실 수 있습니다.</p>" +
      '<p class="nlocked__sub"><a href="auth/mypage.html">내 정보 →</a></p></div>';
    return;
  }

  // 일반회원은 「일상」만 봅니다 (읽기만)
  const VIEW = isAdmin ? CATS : CATS.filter(([k]) => MEMBER_CATS.indexOf(k) >= 0);

  mount.innerHTML =
    '<nav class="ntabs" id="nTabs" aria-label="기록 갈래"></nav>' +
    '<div class="nbar">' +
      '<label class="nsearch"><span class="sr-only">찾기</span>' +
        '<input type="search" id="nQ" placeholder="제목 · 내용 · 장소 · 사람으로 찾기" autocomplete="off"></label>' +
      '<button type="button" class="nbtn" id="nCal">📅 달력</button>' +
      '<button type="button" class="nbtn" id="nGcal">🗓 구글 캘린더</button>' +
      '<button type="button" class="nbtn" id="nXls">⤓ 엑셀로 받기</button>' +
      '<button type="button" class="nbtn nbtn--go" id="nNew">✎ 새 글</button>' +
    "</div>" +
    '<p class="ncount" id="nCount"></p>' +
    '<div class="ncal" id="nCalBox" hidden></div>' +
    '<div class="ngcal" id="nGcalBox" hidden></div>' +
    '<div class="nlist" id="nList"></div>' +
    '<p class="nempty" id="nEmpty" hidden></p>' +
    '<div class="nmodal" id="nModal" role="dialog" aria-modal="true" aria-label="글 쓰기">' +
      '<div class="nmodal__box">' +
        '<h3 id="nmTitle">새 글</h3>' +
        '<label for="nmCat">갈래</label><select id="nmCat"></select>' +
        '<div id="nmTagBox" hidden><label for="nmTag">말머리</label>' +
          '<select id="nmTag"></select></div>' +
        '<label for="nmT">제목</label>' +
        '<input type="text" id="nmT" maxlength="120" placeholder="예: 2026.09.14 세운상가 답사">' +
        '<label for="nmB">내용</label>' +
        '<textarea id="nmB" rows="7" placeholder="날짜를 적으면 달력에 저절로 올라갑니다.&#10;장소: 세운상가&#10;사람: 김철수, 이영희"></textarea>' +
        '<div class="nrow">' +
          '<div><label for="nmD">날짜</label>' +
            '<input type="text" id="nmD" maxlength="12" placeholder="2026.09.14"></div>' +
          '<div><label for="nmP">장소</label>' +
            '<input type="text" id="nmP" maxlength="120"></div>' +
          '<div><label for="nmW">만난 사람</label>' +
            '<input type="text" id="nmW" maxlength="200"></div>' +
        "</div>" +
        '<p class="nhint">제목과 내용에 날짜·장소·사람이 있으면 위 칸을 저절로 채워 드립니다.</p>' +
        '<p class="nmsg" id="nmMsg"></p>' +
        '<div class="nmodal__foot">' +
          '<button type="button" class="nbtn nbtn--del" id="nmDel" hidden>지우기</button>' +
          '<span style="flex:1"></span>' +
          '<button type="button" class="nbtn" id="nmCancel">취소</button>' +
          '<button type="button" class="nbtn nbtn--go" id="nmSave">저장</button>' +
        "</div>" +
      "</div>" +
    "</div>";

  if (!isAdmin) {
    cur = MEMBER_CATS[0];
    ["nNew", "nXls", "nGcal"].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.remove();
    });
  }

  const tabs = document.getElementById("nTabs");
  const list = document.getElementById("nList");
  const q = document.getElementById("nQ");
  const countEl = document.getElementById("nCount");
  const emptyEl = document.getElementById("nEmpty");
  const calBox = document.getElementById("nCalBox");
  const modal = document.getElementById("nModal");
  const msg = document.getElementById("nmMsg");

  // 주소에 ?cat= 이 붙어 오면 그 갈래를 펴 놓습니다 (상단 차림표에서 옵니다)
  const wantCat = new URLSearchParams(location.search).get("cat");
  let rows = [], cur = "all", editing = null;
  if (wantCat && CATS.some(([k]) => k === wantCat)) cur = wantCat;
  let calAt = new Date(); calAt.setDate(1);

  const mCat = document.getElementById("nmCat");
  mCat.innerHTML = CATS.map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  const mTag = document.getElementById("nmTag");
  const mTagBox = document.getElementById("nmTagBox");
  mTag.innerHTML = '<option value="">(없음)</option>' +
    TAGS.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  // 말머리는 회의록에서만 씁니다
  const syncTag = () => { mTagBox.hidden = mCat.value !== "minutes"; };
  mCat.addEventListener("change", syncTag);

  async function load() {
    const r = await sb.from("notes").select("*")
                      .order("event_date", { ascending: false, nullsFirst: false })
                      .order("created_at", { ascending: false });
    if (r.error) {
      mount.innerHTML = '<p class="nempty">' + esc(friendly(r.error.message)) + "</p>";
      throw r.error;
    }
    rows = r.data || [];
    draw();
  }

  const match = (r) => {
    const s = q.value.trim().toLowerCase();
    if (!s) return true;
    return ((r.title || "") + " " + (r.body || "") + " " + (r.tag || "") + " " +
            (r.place || "") + " " + (r.people || "")).toLowerCase().includes(s);
  };
  const shown = () => rows.filter((r) => (cur === "all" || r.category === cur)).filter(match);

  function draw() {
    const mk = (k, label) => {
      const n = (k === "all" ? rows : rows.filter((r) => r.category === k)).filter(match).length;
      return `<button type="button" data-k="${k}"${k === cur ? ' class="on"' : ""}>` +
             `${esc(label)}<span class="n">${n}</span></button>`;
    };
    tabs.innerHTML = (isAdmin ? mk("all", "전체") : "") +
      VIEW.map(([k, v]) => mk(k, v)).join("");
    tabs.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        cur = b.dataset.k;
        const p = new URLSearchParams(location.search);
        if (cur === "all") p.delete("cat"); else p.set("cat", cur);
        history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
        draw();
      }));

    const l = shown();
    countEl.textContent =
      `${cur === "all" ? "전체" : CAT_NAME[cur]} ${l.length}건` +
      (rows.length !== l.length ? ` · 모두 ${rows.length}건` : "");

    if (!calBox.hidden) drawCal();

    if (!l.length) {
      list.innerHTML = "";
      emptyEl.hidden = false;
      emptyEl.textContent = q.value.trim() ? "찾으시는 글이 없습니다." : "아직 적어둔 글이 없습니다.";
      return;
    }
    emptyEl.hidden = true;
    list.innerHTML = l.map((r) =>
      `<article class="nitem" data-id="${r.id}">` +
        `<span class="ncat" style="--c:${CAT_COLOR[r.category] || "#888"}">${esc(CAT_NAME[r.category] || "")}</span>` +
        `<div class="nitem__main">` +
          `<h3>${r.tag ? `<span class="ntag">[${esc(r.tag)}]</span> ` : ""}${esc(r.title)}</h3>` +
          (r.body ? `<p>${esc(r.body).replace(/\n/g, "<br>")}</p>` : "") +
          `<p class="nmeta">` +
            (r.event_date ? `<b>${ymd(r.event_date)}</b>` : "") +
            (r.place ? ` · 📍 ${esc(r.place)}` : "") +
            (r.people ? ` · 👤 ${esc(r.people)}` : "") +
          `</p>` +
        `</div>` +
        (isAdmin ? `<button class="nedit" data-id="${r.id}" title="고치기">✎</button>` : "") +
      "</article>").join("");
    list.querySelectorAll(".nedit").forEach((b) =>
      b.addEventListener("click", () => open(rows.find((x) => x.id === b.dataset.id))));
  }

  /* ── 달력 ── */
  function drawCal() {
    const y = calAt.getFullYear(), m = calAt.getMonth();
    const first = new Date(y, m, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const byDay = {};
    shown().forEach((r) => {
      if (!r.event_date) return;
      (byDay[r.event_date.slice(0, 10)] ||= []).push(r);
    });
    const todayIso = iso(new Date());

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = iso(d);
      const out = d.getMonth() !== m;
      const items = (byDay[key] || []).map((r) =>
        `<span class="cev" style="--c:${CAT_COLOR[r.category]}" title="${esc(r.title)}">` +
        `${esc(r.title)}</span>`).join("");
      cells += `<div class="ccell${out ? " out" : ""}${key === todayIso ? " today" : ""}">` +
        `<span class="cday${d.getDay() === 0 ? " sun" : d.getDay() === 6 ? " sat" : ""}">${d.getDate()}</span>` +
        items + "</div>";
    }
    calBox.innerHTML =
      '<div class="chead">' +
        '<button type="button" class="cnav" id="cPrev">‹</button>' +
        `<b>${y}년 ${m + 1}월</b>` +
        '<button type="button" class="cnav" id="cNext">›</button>' +
        '<button type="button" class="cnav ctoday" id="cToday">오늘</button>' +
      "</div>" +
      '<div class="cgrid chdr">' +
        ["일", "월", "화", "수", "목", "금", "토"].map((d, i) =>
          `<div class="cwd${i === 0 ? " sun" : i === 6 ? " sat" : ""}">${d}</div>`).join("") +
      "</div>" +
      '<div class="cgrid">' + cells + "</div>";
    document.getElementById("cPrev").addEventListener("click", () => { calAt.setMonth(m - 1); drawCal(); });
    document.getElementById("cNext").addEventListener("click", () => { calAt.setMonth(m + 1); drawCal(); });
    document.getElementById("cToday").addEventListener("click", () => {
      calAt = new Date(); calAt.setDate(1); drawCal();
    });
  }

  /* ── 글 쓰기·고치기 ── */
  function open(row) {
    editing = row || null;
    document.getElementById("nmTitle").textContent = row ? "글 고치기" : "새 글";
    document.getElementById("nmDel").hidden = !row;
    mCat.value = row ? row.category : (cur === "all" ? "diary" : cur);
    document.getElementById("nmT").value = row ? row.title || "" : "";
    document.getElementById("nmB").value = row ? row.body || "" : "";
    document.getElementById("nmD").value = row ? ymd(row.event_date) : "";
    document.getElementById("nmP").value = row ? row.place || "" : "";
    document.getElementById("nmW").value = row ? row.people || "" : "";
    mTag.value = row ? (row.tag || "") : "";
    syncTag();
    msg.textContent = "";
    modal.classList.add("on");
    document.getElementById("nmT").focus();
  }
  const close = () => modal.classList.remove("on");
  document.getElementById("nNew").addEventListener("click", () => open(null));
  document.getElementById("nmCancel").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("on")) close();
  });

  /* 제목·내용을 적으면 날짜·장소·사람을 저절로 채웁니다 (비어 있을 때만) */
  function autofill() {
    const text = document.getElementById("nmT").value + "\n" + document.getElementById("nmB").value;
    const dEl = document.getElementById("nmD");
    const pEl = document.getElementById("nmP");
    const wEl = document.getElementById("nmW");
    if (!dEl.value) { const d = findDate(text); if (d) dEl.value = ymd(d); }
    if (!pEl.value) { const p = findField(text, ["장소", "place", "위치"]); if (p) pEl.value = p; }
    if (!wEl.value) { const w = findField(text, ["사람", "만난", "people", "참석"]); if (w) wEl.value = w; }
  }
  document.getElementById("nmT").addEventListener("input", autofill);
  document.getElementById("nmB").addEventListener("input", autofill);

  document.getElementById("nmSave").addEventListener("click", async (e) => {
    const title = document.getElementById("nmT").value.trim();
    if (!title) { msg.textContent = "제목을 적어주세요."; return; }
    const body = document.getElementById("nmB").value.trim();
    const dRaw = document.getElementById("nmD").value.trim();
    const patch = {
      category: mCat.value,
      title, body: body || null,
      event_date: dRaw ? findDate(dRaw) : findDate(title + "\n" + body),
      place:  document.getElementById("nmP").value.trim() || null,
      people: document.getElementById("nmW").value.trim() || null,
      tag:    mCat.value === "minutes" ? (mTag.value || null) : null,
    };
    e.target.disabled = true;
    msg.textContent = "저장하는 중…";
    const r = editing
      ? await sb.from("notes").update(patch).eq("id", editing.id)
      : await sb.from("notes").insert({ ...patch, created_by: user.id });
    e.target.disabled = false;
    if (r.error) { msg.textContent = friendly(r.error.message); return; }
    close();
    await load();
  });

  document.getElementById("nmDel").addEventListener("click", async () => {
    if (!editing) return;
    if (!confirm(`「${editing.title}」 을 지울까요?`)) return;
    const { error } = await sb.from("notes").delete().eq("id", editing.id);
    if (error) { msg.textContent = friendly(error.message); return; }
    close();
    await load();
  });

  /* ── 달력 켜고 끄기 · 엑셀 ── */
  document.getElementById("nCal").addEventListener("click", () => {
    calBox.hidden = !calBox.hidden;
    document.getElementById("nCal").classList.toggle("on", !calBox.hidden);
    if (!calBox.hidden) drawCal();
  });
  /* 구글 캘린더 — 크롬이 그 계정으로 로그인돼 있으면 그대로 보입니다 */
  const gBox = document.getElementById("nGcalBox");
  const gBtn = document.getElementById("nGcal");
  gBtn.addEventListener("click", () => {
    gBox.hidden = !gBox.hidden;
    gBtn.classList.toggle("on", !gBox.hidden);
    if (!gBox.hidden && !gBox.dataset.on) {
      gBox.dataset.on = "1";
      const url = "https://calendar.google.com/calendar/embed?" +
        "src=" + encodeURIComponent(GCAL) +
        "&ctz=Asia%2FSeoul&mode=MONTH&wkst=1&showTitle=0&showPrint=0&showTabs=1" +
        "&showCalendars=0&showTz=0&bgcolor=%23ffffff";
      gBox.innerHTML =
        '<p class="ngcal__note">구글 캘린더 <b>' + esc(GCAL) + '</b> 입니다. ' +
        '이 브라우저가 그 계정으로 로그인돼 있어야 보입니다. ' +
        '<a href="https://calendar.google.com/" target="_blank" rel="noopener">구글 캘린더 열기 →</a></p>' +
        '<iframe src="' + url + '" title="구글 캘린더" loading="lazy"></iframe>';
    }
  });

  document.getElementById("nXls").addEventListener("click", () => {
    const l = shown();
    if (!l.length) { alert("내려받을 글이 없습니다."); return; }
    const t = new Date();
    download(`기록_${cur === "all" ? "전체" : CAT_NAME[cur]}_` +
             `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}.csv`, toCSV(l));
  });

  q.addEventListener("input", draw);
  await load();
}
