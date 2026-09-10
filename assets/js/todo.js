// ─── 해야할일 — Contact 의 체크리스트 ────────────────────────
//
//  관리자만 봅니다. 줄은 Supabase 의 todos 표에 쌓입니다 (auth/todo_setup.sql).
//  아직 그 SQL 을 안 돌리셨으면 이 브라우저의 저장소(localStorage)에 두고 알려 드립니다 —
//  그래도 곧바로 쓸 수 있고, 표를 만든 뒤에는 「표로 옮기기」 로 넘깁니다.
//
//  · 적고 Enter(또는 ＋ 추가) → 줄이 생깁니다. 마감 날짜는 선택입니다.
//  · ✓ 를 누르면 줄을 긋고 아래로,  ★ 를 누르면 맨 위로
//  · 글을 누르면 그 자리에서 고칩니다 (Enter 저장 · Esc 취소),  ✕ 는 지우기
//  · ▲▼ 로 한 칸씩, 또는 줄을 끌어다 놓아 차례를 바꿉니다 (별표끼리 · 보통끼리)
import { sb, currentUser, myProfile } from "../../auth/auth.js";
import * as TL from "./todo-list.js?v=202609101700";

export const OWNERS = ["whlove@gmail.com", "skyish76@gmail.com"];
const LS_KEY = "skyish-todos";
const NL = String.fromCharCode(10);

const esc = (s) => String(s == null ? "" : s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 표가 아직 없을 때 나는 오류인가 */
const noTable = (e) => !!e && /does not exist|relation|schema cache|42P01|Could not find the table/i
  .test(String(e.message || e.details || e.hint || ""));

export async function initTodo(mountId = "todoapp", sectionId = "todosec") {
  const mount = document.getElementById(mountId);
  if (!mount) return false;
  const section = document.getElementById(sectionId);

  const user = await currentUser();
  const me = user ? await myProfile().catch(() => null) : null;
  const mail = ((user && user.email) || "").toLowerCase();
  const isAdmin = !!(me && me.is_admin) || OWNERS.indexOf(mail) >= 0;
  if (!isAdmin) { if (section) section.remove(); else mount.remove(); return false; }

  let rows = [], local = false, editing = null;

  /* ── 저장소 ── */
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } };
  const writeLocal = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); } catch (e) {} };

  let migrated = 0;                    // 이번에 브라우저 저장소에서 표로 옮긴 줄 수
  async function load() {
    let r = await sb.from("todos").select("*").order("created_at", { ascending: true });
    if (r.error) {
      if (!noTable(r.error)) throw r.error;
      local = true; rows = readLocal();
      return;
    }
    local = false; rows = r.data || [];
    /* 표가 생기기 전에 이 브라우저에 적어 둔 줄이 남아 있으면 저절로 표로 옮깁니다 —
       전에는 표가 생긴 뒤에 「표로 옮기기」 고리가 사라져 옮길 길이 없었습니다. */
    if (readLocal().length) {
      try {
        migrated = await moveToTable();
        if (migrated) {
          r = await sb.from("todos").select("*").order("created_at", { ascending: true });
          if (!r.error) rows = r.data || [];
        }
      } catch (e) { /* 못 옮겨도 표의 것은 보여 줍니다 */ }
    }
  }

  async function add(text, due) {
    const it = TL.newItem(text, due);
    if (!it) return;
    it.sort = TL.nextSort(rows);
    if (local) {
      rows.push(Object.assign({ id: "l" + Date.now() + Math.random().toString(36).slice(2, 6) }, it));
      writeLocal(); return;
    }
    const r = await sb.from("todos").insert(Object.assign({ created_by: user.id }, it)).select().single();
    if (r.error) throw r.error;
    rows.push(r.data);
  }

  async function patch(id, change) {
    const it = rows.find((x) => x.id === id);
    if (!it) return;
    const p = TL.patchFor(it, change);
    if ("sort" in change && change.sort !== it.sort) p.sort = change.sort;
    if (!Object.keys(p).length) return;
    if (!local) {
      const r = await sb.from("todos").update(p).eq("id", id);
      if (r.error) throw r.error;
    }
    Object.assign(it, p);
    if (local) writeLocal();
  }

  async function remove(id) {
    if (!local) {
      const r = await sb.from("todos").delete().eq("id", id);
      if (r.error) throw r.error;
    }
    rows = rows.filter((x) => x.id !== id);
    if (local) writeLocal();
  }

  /** 차례 바꾸기 — dir 은 -1(위) · +1(아래) · 줄 id(그 줄 앞으로) · ""(맨 아래) */
  async function move(id, dir) {
    const ch = TL.reorder(rows, id, dir);
    for (const c of ch) await patch(c.id, { sort: c.sort });
    return ch.length > 0;
  }

  /** 브라우저에 쌓인 것을 표로 옮깁니다 — SQL 을 돌리신 뒤 한 번 */
  async function moveToTable() {
    const mine = readLocal();
    if (!mine.length) return 0;
    let n = 0;
    for (const it of mine) {
      const r = await sb.from("todos").insert({
        created_by: user.id, text: it.text, due: it.due || null, done: !!it.done,
        star: !!it.star, done_at: it.done_at || null, created_at: it.created_at || new Date().toISOString(),
        sort: typeof it.sort === "number" ? it.sort : null,
      });
      if (!r.error) n++;
    }
    if (n === mine.length) { try { localStorage.removeItem(LS_KEY); } catch (e) {} }
    return n;
  }

  /* ── 화면 ── */
  mount.innerHTML =
    '<div class="todo">' +
      '<div class="todo__head"><h3 id="tdTitle"></h3><p class="todo__count" id="tdCount"></p></div>' +
      /* 한 줄 — 글 칸 · 작은 날짜 단추(📅) · 추가.  날짜 칸은 숨겨 두고 단추가 엽니다
         (「내가 해야할일과 날짜선택이 두줄로 나눠져. 한줄로, 날짜선택을 작은 버튼으로」) */
      '<form class="todo__add" id="tdAdd" autocomplete="off">' +
        '<input type="text" id="tdText" maxlength="300" placeholder="곧 해야 할 일을 적고 Enter" aria-label="할 일">' +
        '<button type="button" class="todo__duebtn" id="tdDueBtn" title="마감 날짜 (없어도 됩니다)" aria-label="마감 날짜">📅</button>' +
        '<input type="date" id="tdDue" class="todo__duein" aria-label="마감" tabindex="-1">' +
        '<button type="submit" class="nbtn nbtn--go todo__addbtn" title="추가">＋</button>' +
      "</form>" +
      '<p class="todo__hint" id="tdHint" hidden></p>' +
      '<ul class="todo__list" id="tdList"></ul>' +
      '<p class="nempty" id="tdEmpty" hidden>아직 적은 일이 없습니다 — 위에 적어 보세요.</p>' +
      '<div class="todo__foot" id="tdFoot" hidden>' +
        '<button type="button" class="nbtn" id="tdClear">완료한 것 모두 지우기</button>' +
      "</div>" +
    "</div>";

  const $ = (id) => document.getElementById(id);
  const say = (t) => { const h = $("tdHint"); h.hidden = !t; h.innerHTML = t || ""; };

  /* 📅 단추 → 숨은 날짜 칸을 엽니다. 고르면 단추에 「9.18」 처럼 보입니다 */
  const dueBtn = $("tdDueBtn"), dueIn = $("tdDue");
  const showDue = () => {
    const v = dueIn.value;
    dueBtn.textContent = v ? v.slice(5).replace("-", ".").replace(/^0/, "").replace(/\.0/, ".") : "📅";
    dueBtn.classList.toggle("has-date", !!v);
  };
  dueBtn.addEventListener("click", () => {
    try { if (typeof dueIn.showPicker === "function") dueIn.showPicker(); else dueIn.click(); }
    catch (e) { try { dueIn.focus(); dueIn.click(); } catch (x) {} }
  });
  dueIn.addEventListener("change", showDue);

  function rowHtml(x) {
    const st = TL.dueState(x);
    return '<li class="td' + (x.done ? " is-done" : "") + (x.star ? " is-star" : "") +
             (st ? " due-" + st : "") + '" data-id="' + esc(x.id) + '"' + (x.done ? "" : ' draggable="true"') + ">" +
      '<button type="button" class="td__chk" data-act="done" title="' + (x.done ? "되돌리기" : "완료") + '" aria-pressed="' + !!x.done + '">✓</button>' +
      '<button type="button" class="td__star" data-act="star" title="' + (x.star ? "별표 빼기" : "중요 — 맨 위로") + '" aria-pressed="' + !!x.star + '">★</button>' +
      '<span class="td__body">' +
        '<span class="td__text" data-act="edit" title="눌러서 고치기">' + esc(x.text) + "</span>" +
        (st ? '<span class="td__due">' + esc(TL.dueLabel(x)) + "</span>" : "") +
      "</span>" +
      '<span class="td__acts">' +
        (x.done ? "" :
          '<button type="button" class="td__ic" data-act="up" title="위로">▲</button>' +
          '<button type="button" class="td__ic" data-act="down" title="아래로">▼</button>') +
        '<button type="button" class="td__ic" data-act="edit" title="고치기">✎</button>' +
        '<button type="button" class="td__ic td__ic--del" data-act="del" title="지우기">✕</button>' +
      "</span></li>";
  }

  function render() {
    $("tdTitle").textContent = TL.todayTitle();
    const c = TL.counts(rows);
    $("tdCount").textContent = c.total
      ? "남은 일 " + c.open + (c.star ? " · 중요 " + c.star : "") + (c.today ? " · 오늘까지 " + c.today : "") +
        " · 완료 " + c.done
      : "";
    const list = TL.sortItems(rows);
    $("tdList").innerHTML = list.map(rowHtml).join("");
    $("tdEmpty").hidden = list.length > 0;
    $("tdFoot").hidden = !c.done;
    if (local) {
      say("지금은 <b>이 브라우저에만</b> 저장됩니다 (todos 표가 아직 없습니다). " +
          "다른 기기에서도 보시려면 Supabase → SQL Editor 에서 <code>auth/todo_setup.sql</code> 을 한 번 돌리신 뒤 " +
          '<a href="#" id="tdMove">표로 옮기기</a> 를 누르세요.');
      const mv = $("tdMove");
      if (mv) mv.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const probe = await sb.from("todos").select("id").limit(1);
          if (probe.error) { alert("아직 todos 표가 없습니다 — SQL 을 먼저 돌려 주세요." + NL + probe.error.message); return; }
          const n = await moveToTable();
          await load(); render();
          alert(n + "줄을 표로 옮겼습니다.");
        } catch (err) { alert("옮기지 못했습니다 — " + (err && err.message)); }
      });
    } else if (migrated) {
      say("이 브라우저에 적어 두었던 " + migrated + "줄을 표로 옮겼습니다 — 이제 어느 기기에서나 같이 보입니다.");
    } else say("");
  }

  /* 글을 그 자리에서 고치기 */
  function startEdit(li, x) {
    if (editing) return;
    editing = x.id;
    const span = li.querySelector(".td__text");
    const inp = document.createElement("input");
    inp.type = "text"; inp.className = "td__edit"; inp.value = x.text; inp.maxLength = 300;
    span.replaceWith(inp);
    inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
    let done = false;
    const finish = async (save) => {
      if (done) return; done = true; editing = null;
      if (save) {
        try { await patch(x.id, { text: inp.value }); }
        catch (err) { alert("고치지 못했습니다 — " + (err && err.message)); }
      }
      render();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      else if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });
    inp.addEventListener("blur", () => finish(true));
  }

  $("tdAdd").addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = $("tdText").value, d = $("tdDue").value;
    if (!t.trim()) { $("tdText").focus(); return; }
    try { await add(t, d); $("tdText").value = ""; $("tdDue").value = ""; showDue(); render(); $("tdText").focus(); }
    catch (err) { alert("적지 못했습니다 — " + (err && err.message)); }
  });

  $("tdList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const li = b.closest("li.td");
    const x = rows.find((r) => r.id === li.dataset.id);
    if (!x) return;
    const act = b.dataset.act;
    try {
      if (act === "done") { await patch(x.id, { done: !x.done }); render(); }
      else if (act === "star") { await patch(x.id, { star: !x.star }); render(); }
      else if (act === "up" || act === "down") { if (await move(x.id, act === "up" ? -1 : 1)) render(); }
      else if (act === "edit") { startEdit(li, x); }
      else if (act === "del") {
        if (!confirm("지울까요?" + NL + x.text)) return;
        await remove(x.id); render();
      }
    } catch (err) { alert("바꾸지 못했습니다 — " + (err && err.message)); }
  });

  /* 끌어다 놓기 — 줄을 잡아 다른 줄 위에 놓으면 그 앞으로, 빈 데 놓으면 맨 아래로 */
  let dragId = null;
  const list = $("tdList");
  list.addEventListener("dragstart", (e) => {
    const li = e.target.closest && e.target.closest("li.td");
    if (!li || editing) { e.preventDefault(); return; }
    dragId = li.dataset.id; li.classList.add("is-drag");
    try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); } catch (x) {}
  });
  list.addEventListener("dragover", (e) => {
    if (!dragId) return;
    e.preventDefault();
    list.querySelectorAll(".is-over").forEach((el) => el.classList.remove("is-over"));
    const li = e.target.closest && e.target.closest("li.td");
    if (li && li.dataset.id !== dragId) li.classList.add("is-over");
  });
  list.addEventListener("dragleave", (e) => {
    const li = e.target.closest && e.target.closest("li.td");
    if (li) li.classList.remove("is-over");
  });
  list.addEventListener("drop", async (e) => {
    if (!dragId) return;
    e.preventDefault();
    const li = e.target.closest && e.target.closest("li.td");
    const to = li ? li.dataset.id : "";
    const id = dragId; dragId = null;
    if (to === id) { render(); return; }
    try { await move(id, to); } catch (err) { alert("옮기지 못했습니다 — " + (err && err.message)); }
    render();
  });
  list.addEventListener("dragend", () => {
    dragId = null;
    list.querySelectorAll(".is-drag, .is-over").forEach((el) => el.classList.remove("is-drag", "is-over"));
  });

  $("tdClear").addEventListener("click", async () => {
    const done = rows.filter((x) => x.done);
    if (!done.length || !confirm("완료한 " + done.length + "줄을 모두 지울까요?")) return;
    try { for (const x of done) await remove(x.id); render(); }
    catch (err) { alert("지우지 못했습니다 — " + (err && err.message)); }
  });

  try { await load(); }
  catch (err) { mount.innerHTML = '<p class="nempty">해야할일을 읽지 못했습니다 — ' + esc(err && err.message) + "</p>"; return true; }
  render();
  return true;
}
