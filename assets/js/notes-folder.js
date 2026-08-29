// ─── 0_schedule 폴더에서 일정 글 만들기 ──────────────────────
// 폴더 하나가 행사 하나입니다.
//
//   0_schedule/20260828_[토론] 자치행정학회_/
//       intro/    행사 정보 (프로그램 · 개최계획 · 공문 · 리플렛)
//       final/    내 발표·토론 자료
//       mid/      그 중간본
//       references/  참고자료 (남의 자료)
//
// 폴더 이름을 읽어 날짜·유형·기관·주제를 잡고,
// intro·final 자료에서 행사명·장소·같은 자리 사람을 뽑고,
// 구글 달력의 같은 날 일정과 맞춰 봅니다.
// 마지막에 표로 보여 드리니, 고칠 것은 고치고 만드시면 됩니다.
import * as NF from "./notes-files.js?v=202608301500";
import { sb } from "../../auth/auth.js";

const NL = String.fromCharCode(10);
const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

/** 올려 봐야 소용없는 파일 — 오피스 임시본 · 숨김 · 윈도 부산물 */
export const JUNK = /^(~\$|\.)|^(desktop\.ini|Thumbs\.db)$/i;

/** 붙임으로 올릴 갈래 — 참고자료(ref)와 중간본(mid)은 무겁고 남의 것이라 뺍니다 */
export const ATTACH = ["intro", "final", "note"];

/** 한 파일 20MB — notes-files.js 의 MAX 와 같아야 합니다 */
export const MAXSIZE = 20 * 1024 * 1024;


/* ── 폴더 이름 읽기 ────────────────────────────────────────
   20260828_[토론] 자치행정학회_
   20260824_[발표]_국토도시계획학회_역세권 주택공급
   → { date, kind, org, topic } */
export function parseFolder(name) {
  const s = String(name || "").trim();
  const m = s.match(/^(\d{4})(\d{2})(\d{2})[_\s]*(?:\[([^\]]*)\])?[_\s]*(.*)$/);
  if (!m) return { date: "", kind: "", org: s, topic: "" };

  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const kind = (m[4] || "").trim();
  const rest = (m[5] || "").replace(/[_\s]+$/, "");
  const bits = rest.split("_").map((x) => x.trim()).filter(Boolean);
  return { date, kind, org: bits[0] || "", topic: bits.slice(1).join(" ") };
}


/* ── 폴더의 [유형] 을 Schedule 말머리로 옮기기 ──
   폴더에 적으신 말이 말머리 목록에 없으면 가장 가까운 것으로 놓습니다.
   틀리면 표에서 바로 고치실 수 있습니다. */
export function tagFor(kind) {
  const k = String(kind || "");
  if (/자문\s*회의/.test(k)) return "자문회의";
  if (/자문/.test(k))        return "자문참석";
  if (/토론/.test(k))        return "토론";
  if (/(발표|특강|강의|강연)/.test(k)) return "발표";
  if (/세미나/.test(k))      return "세미나참석";
  if (/GRI|경기연구원/i.test(k)) return "GRI행사";
  return "";
}


/* ── 파일이 어느 갈래인지 ──────────────────────────────────
   ① 파일 이름의 [intro] [final] 표시  ② 상위 폴더 이름  ③ 파일 이름의 낱말 */
export function roleOf(rel, name) {
  const n = String(name || "");
  const low = n.toLowerCase();
  if (JUNK.test(n)) return "junk";
  if (/[\\/]\.claude[\\/]/.test("/" + rel)) return "junk";

  if (/\[\s*intro\s*\]/i.test(n)) return "intro";
  if (/\[\s*final\s*\]/i.test(n)) return "final";

  const segs = String(rel || "").split(/[\\/]/).slice(0, -1).map((s) => s.toLowerCase().trim());
  for (const s of segs) {
    if (s === "intro" || s === "행사정보") return "intro";
    if (s === "final" || s === "발표자료") return "final";
    if (s === "mid" || s === "중간본") return "mid";
    if (s === "ref" || s === "refs" || s === "reference" || s === "references" ||
        s === "참고" || s === "참고자료") return "ref";
  }

  // 폴더로 나뉘어 있지 않으면 파일 이름으로 짐작합니다
  if (/(프로그램|개최|계획|공문|리플렛|초청|안내|개요|운영계획|붙임)/.test(n)) return "intro";
  if (/(회의록|메모|녹취|기록)/.test(n)) return "note";
  if (/남지현/.test(n) && /(최종|final)/i.test(low)) return "final";
  if (/(발표자료|토론문)/.test(n) && /남지현/.test(n)) return "final";
  return "ref";
}


/* ── 파일 목록을 행사별로 묶기 ─────────────────────────────
   webkitRelativePath 에서 「20260828_…」 꼴의 칸을 찾아 그것을 행사로 봅니다. */
export function groupFiles(list) {
  const out = new Map();

  [...list].forEach((file) => {
    const rel = file.webkitRelativePath || file.name;
    const segs = rel.split(/[\\/]/);
    let at = segs.findIndex((s) => /^\d{8}[_\s]/.test(s));
    if (at < 0) at = segs.length > 1 ? 0 : -1;      // 날짜 폴더가 없으면 맨 위 칸을 씁니다
    const folder = at < 0 ? "(폴더 없음)" : segs[at];
    const inner = segs.slice(at + 1).join("/");

    if (!out.has(folder)) {
      const p = parseFolder(folder);
      out.set(folder, { folder, ...p, files: [], skipped: [] });
    }
    const ev = out.get(folder);
    const role = roleOf(inner, file.name);
    if (role === "junk") return;

    // 같은 이름·같은 크기는 사본이므로 한 번만 (엑셀/ 아래 사본 같은 것)
    if (ev.files.some((f) => f.file.name === file.name && f.file.size === file.size)) return;
    ev.files.push({ file, role, rel: inner || file.name });
  });

  return [...out.values()].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}


/* ── 파일 이름·글에서 날짜 후보 모으기 ──────────────────────
   폴더 이름의 날짜가 틀린 일이 있습니다.
   (20260824 폴더인데 자료는 2026.9.2 인 경우가 실제로 있었습니다) */
export function datesIn(text) {
  const s = String(text || "");
  const got = [];
  const push = (y, m, d) => {
    y = +y; m = +m; d = +d;
    if (y < 100) y += 2000;
    if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return;
    const v = `${y}-${pad(m)}-${pad(d)}`;
    if (got.indexOf(v) < 0) got.push(v);
  };
  let m;
  const re1 = /(20\d\d)\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;
  while ((m = re1.exec(s))) push(m[1], m[2], m[3]);
  // _260902_ 처럼 밑줄에 붙어 있으면 \b 가 걸리지 않습니다. 숫자만으로 끊습니다.
  const re2 = /(?<![0-9])(20\d{2})(\d{2})(\d{2})(?![0-9])/g;   // 20260902 꼴
  while ((m = re2.exec(s))) push(m[1], m[2], m[3]);
  const re3 = /(?<![0-9])(\d{2})(\d{2})(\d{2})(?![0-9])/g;     // 260902 꼴
  while ((m = re3.exec(s))) push(m[1], m[2], m[3]);
  return got;
}


/* ── 행사 하나를 읽어 사실을 채웁니다 ──────────────────────── */
export async function readEvent(ev, say) {
  const pick = ev.files.filter((f) => f.role === "intro" || f.role === "final");
  const readable = pick.filter((f) => {
    const k = NF.kind(f.file);
    return k === "pdf" || k === "excel" || k === "csv" || k === "text";
  });

  ev.eventName = "";
  ev.place = "";
  ev.people = "";
  ev.blocks = [];
  ev.dateGuess = [];

  // 파일 이름에서도 날짜를 주워 둡니다 (…_260902_final.pdf)
  ev.files.forEach((f) => datesIn(f.file.name).forEach((d) => {
    if (ev.dateGuess.indexOf(d) < 0) ev.dateGuess.push(d);
  }));

  for (const f of readable) {
    if (say) say(ev.folder + " — " + f.file.name);
    let r;
    try { r = await NF.extract(f.file); }
    catch (e) { r = { total: 0, mine: [], head: [], people: [], event: "", error: e.message }; }

    if (r.event && !ev.eventName) ev.eventName = r.event;
    if (r.people && r.people.length) {
      const has = ev.people ? ev.people.split(/\s*,\s*/) : [];
      r.people.forEach((p) => { if (has.indexOf(p) < 0) has.push(p); });
      ev.people = has.join(", ");
    }
    const t = NF.asText(f.file.name, r);
    if (t) ev.blocks.push(t);

    // 뽑아낸 글 안의 날짜도 후보에 넣습니다
    (r.mine || []).concat(r.head || []).forEach((x) =>
      datesIn(x.line).forEach((d) => { if (ev.dateGuess.indexOf(d) < 0) ev.dateGuess.push(d); }));
  }

  if (!ev.eventName) ev.eventName = [ev.org, ev.topic].filter(Boolean).join(" ");
  ev.tag = tagFor(ev.kind);
  ev.title = ev.kind ? `[${ev.kind}] ${[ev.org, ev.topic].filter(Boolean).join(" ")}`.trim()
                     : ([ev.org, ev.topic].filter(Boolean).join(" ") || ev.folder);
  return ev;
}


/* ── 구글 달력 일정과 맞춰 보기 ──────────────────────────────
   같은 날 일정이 있으면 제목·시각·장소를 그쪽에서 가져옵니다. */
export function matchCal(ev, gEvents) {
  const near = (gEvents || []).filter((g) => g.date === ev.date);
  if (!near.length) return null;
  if (near.length === 1) return near[0];

  // 여럿이면 기관·주제 낱말이 겹치는 것을 고릅니다
  const words = (ev.org + " " + ev.topic).split(/\s+/).filter((w) => w.length >= 2);
  let best = null, score = 0;
  near.forEach((g) => {
    const s = words.filter((w) => g.title.indexOf(w) >= 0).length;
    if (s > score) { score = s; best = g; }
  });
  return best || near[0];
}


/* ── 글 본문 짜기 ──────────────────────────────────────────── */
export function buildBody(ev) {
  const head = [];
  if (ev.eventName) head.push("행사: " + ev.eventName);
  if (ev.time)  head.push("시각: " + ev.time);
  if (ev.place) head.push("장소: " + ev.place);
  if (ev.kind)  head.push("역할: " + ev.kind);
  if (ev.cal)   head.push("캘린더: " + ev.cal);
  head.push("자료: " + ev.folder);
  return head.join(NL) + (ev.blocks.length ? NL + NL + ev.blocks.join(NL + NL) : "");
}


/* ══════════════════════════════════════════════════════════
   화면 — 고른 폴더를 표로 보여 주고, 고친 뒤 만듭니다
   ══════════════════════════════════════════════════════════ */
export async function openImport(list, ctx) {
  const box = document.getElementById("nImp");
  if (!box) return;

  const evs = groupFiles(list);
  if (!evs.length) {
    alert("행사 폴더를 찾지 못했습니다.\n0_schedule 처럼 「20260828_[토론] …」 꼴 폴더가 든 곳을 골라 주세요.");
    return;
  }

  const shell = (inner) =>
    '<div class="nimp__box">' +
      '<button type="button" class="ndet__x" id="niX">✕</button>' +
      "<h3>폴더에서 일정 가져오기</h3>" + inner +
    "</div>";

  box.innerHTML = shell('<p class="nimp__msg" id="niMsg">자료를 읽는 중…</p>');
  box.classList.add("on");
  const shut = () => box.classList.remove("on");
  document.getElementById("niX").addEventListener("click", shut);

  const say = (t) => {
    const m = document.getElementById("niMsg");
    if (m) m.textContent = t;
  };

  /* ① 자료 읽기 — 한 번에 하나씩 (한꺼번에 하면 브라우저가 버팁니다) */
  for (let i = 0; i < evs.length; i++) {
    say(`자료를 읽는 중… (${i + 1}/${evs.length}) ${evs[i].folder}`);
    await readEvent(evs[i], say);
  }

  /* ② 구글 달력 맞추기 */
  let gAll = [];
  if (ctx.monthEvents) {
    const months = new Set();
    evs.forEach((e) => { if (e.date) months.add(e.date.slice(0, 7)); });
    for (const ym of months) {
      say("달력을 맞춰 보는 중… " + ym);
      try {
        const [y, m] = ym.split("-");
        gAll = gAll.concat(await ctx.monthEvents(+y, +m - 1) || []);
      } catch (e) { /* 달력이 없어도 그냥 갑니다 */ }
    }
  }
  evs.forEach((e) => {
    const g = matchCal(e, gAll);
    if (g) {
      e.cal = g.cal || "";
      e.time = g.time || "";
      if (!e.place) e.place = g.place || "";
      e.calTitle = g.title || "";
    }
  });

  /* ③ 이미 올라간 글은 건너뜁니다 (날짜 + 제목) */
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const have = new Set((ctx.rows || [])
    .filter((r) => r.category === "schedule" || r.category === "diary")
    .map((r) => (r.event_date || "").slice(0, 10) + "|" + norm(r.title)));

  /* ④ 표로 보여 줍니다 — 여기서 손으로 고칠 수 있습니다 */
  const rowHtml = (e, i) => {
    const dup = have.has(e.date + "|" + norm(e.title));
    const att = e.files.filter((f) => ATTACH.indexOf(f.role) >= 0);
    const big = att.filter((f) => f.file.size > MAXSIZE);
    const ok  = att.filter((f) => f.file.size <= MAXSIZE);
    const other = e.dateGuess.filter((d) => d !== e.date);
    return (
      `<tr data-i="${i}"${dup ? ' class="dup"' : ""}>` +
        `<td><input type="checkbox" class="niPick"${dup ? "" : " checked"}></td>` +
        `<td><input type="text" class="niD" value="${esc(e.date)}" size="10">` +
          (other.length
            ? `<div class="nimp__warn">자료에는 ${esc(other.join(" · "))} 로도 적혀 있습니다</div>`
            : "") +
        "</td>" +
        `<td><select class="niG">` +
          '<option value="">(없음)</option>' +
          (ctx.tags || []).map((t) =>
            `<option value="${esc(t)}"${t === e.tag ? " selected" : ""}>${esc(t)}</option>`).join("") +
        "</select></td>" +
        `<td><input type="text" class="niT" value="${esc(e.calTitle || e.title)}"></td>` +
        `<td><input type="text" class="niE" value="${esc(e.eventName)}"></td>` +
        `<td><input type="text" class="niP" value="${esc(e.place || "")}"></td>` +
        `<td><input type="text" class="niW" value="${esc(e.people || "")}"></td>` +
        `<td class="niF">${ok.length}개` +
          (big.length ? `<div class="nimp__warn">${big.length}개는 20MB 를 넘어 뺍니다</div>` : "") +
          (dup ? '<div class="nimp__warn">이미 올라간 글</div>' : "") +
        "</td>" +
      "</tr>");
  };

  box.innerHTML = shell(
    `<p class="nimp__msg">행사 <b>${evs.length}건</b>을 찾았습니다. ` +
      "고치실 것은 고치고, 만들 것만 골라 주세요.</p>" +
    '<div class="nimp__scroll"><table class="nimp__tbl">' +
      "<thead><tr><th></th><th>날짜</th><th>말머리</th><th>제목</th><th>행사명</th>" +
      "<th>장소</th><th>만난 사람</th><th>붙임</th></tr></thead>" +
      "<tbody>" + evs.map(rowHtml).join("") + "</tbody>" +
    "</table></div>" +
    '<p class="nimp__msg" id="niMsg"></p>' +
    '<div class="ndet__foot">' +
      '<button type="button" class="nbtn" id="niClose">닫기</button>' +
      '<button type="button" class="nbtn nbtn--go" id="niGo">이대로 만들기</button>' +
    "</div>");

  document.getElementById("niX").addEventListener("click", shut);
  document.getElementById("niClose").addEventListener("click", shut);

  /* ⑤ 만들기 */
  document.getElementById("niGo").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const trs = [...box.querySelectorAll("tbody tr")]
      .filter((tr) => tr.querySelector(".niPick").checked);
    if (!trs.length) { say("고른 행사가 없습니다."); return; }

    btn.disabled = true;
    let made = 0, failed = 0;
    const skippedFiles = [];

    for (let i = 0; i < trs.length; i++) {
      const tr = trs[i];
      const ev = evs[+tr.dataset.i];
      const v = (cls) => tr.querySelector(cls).value.trim();
      ev.date = v(".niD"); ev.eventName = v(".niE");
      ev.place = v(".niP"); ev.people = v(".niW");
      const title = v(".niT") || ev.folder;
      ev.tag = tr.querySelector(".niG").value;

      say(`만드는 중… (${i + 1}/${trs.length}) ${title}`);

      // 붙임 파일 올리기 — 하나가 실패해도 글은 만듭니다
      const up = [];
      for (const f of ev.files.filter((x) => ATTACH.indexOf(x.role) >= 0)) {
        if (f.file.size > MAXSIZE) { skippedFiles.push(f.file.name + " (20MB 넘음)"); continue; }
        try { up.push(await NF.upload(f.file)); }
        catch (err) { skippedFiles.push(f.file.name + " (" + err.message + ")"); }
      }

      const patch = {
        category: "schedule",
        title,
        body: buildBody(ev) || null,
        event_date: /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : null,
        place: ev.place || null,
        people: ev.people || null,
        event: ev.eventName || null,
        tag: ev.tag || null,
        files: up,
      };

      let r = await sb.from("notes").insert({ ...patch, created_by: ctx.user.id });
      if (r.error && /event/.test(r.error.message) && /column|schema cache/i.test(r.error.message)) {
        const { event: _drop, ...rest } = patch;
        r = await sb.from("notes").insert({ ...rest, created_by: ctx.user.id });
      }
      if (r.error) { failed++; say(title + " — " + r.error.message); }
      else made++;
    }

    btn.disabled = false;
    shut();
    if (ctx.reload) await ctx.reload();
    alert(`${made}건을 만들었습니다.` +
      (failed ? `${NL}${failed}건은 실패했습니다.` : "") +
      (skippedFiles.length ? `${NL}${NL}뺀 파일:${NL}` + skippedFiles.join(NL) : ""));
  });
}
