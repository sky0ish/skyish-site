// ─── Contact 의 네 갈래 ─────────────────────────────────────
//
//   To Me    문의 보내기 — 누구나
//   활동기관  몸담고 있는 곳 — 누구나
//   최신뉴스  AI · 건축 · 도시 · 부동산 — 누구나
//   주소록    내 컴퓨터의 명함첩·동문 명부 — 관리자만
//   Sites    자주 드나드는 곳 — 관리자만
//   해야할일  오늘의 체크리스트 — 관리자만
//
// 관리자가 아니면 뒤의 세 갈래는 단추째 사라집니다.
import { initAddr } from "./addressbook.js?v=202609170900";
import { initSites } from "./sites.js?v=202609010300";
import { initOrgs } from "./orgs.js?v=202609010300";
import { initTodo } from "./todo.js?v=202609111800";
import { initNews } from "./news.js?v=202610031600";

export async function initContactTabs() {
  const tabs = document.getElementById("cTabs");
  if (!tabs) return;

  const panes = {
    tome:  document.querySelector(".contact-grid"),
    web:   document.getElementById("websec"),     // 1. 활동기관 + 2. 자주 가는 사이트
    news:  document.getElementById("newssec"),
    addr:  document.getElementById("addrsec"),
    todo:  document.getElementById("todosec"),
  };

  function show(k) {
    document.documentElement.dataset.cp = k;      // contact.html 머리의 미리 감추기와 짝
    tabs.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("on", b.dataset.p === k));
    Object.entries(panes).forEach(([p, el]) => {
      if (!el) return;
      // .contact-grid 는 section 이 아니라 격자라 hidden 대신 보임새로 감춥니다
      if (p === "tome") el.style.display = (k === "tome") ? "" : "none";
      else el.hidden = (k !== p);
    });
    /* 받은 메시지는 To Me 와 함께 보입니다 (관리자에게만 — 아니면 contact-form.js 가 지웁니다) */
    const inbox = document.getElementById("inbox");
    if (inbox) {
      inbox.dataset.off = (k === "tome") ? "" : "1";
      inbox.hidden = (k !== "tome");
    }
    const u = new URL(location.href);
    if (k === "tome") u.searchParams.delete("p"); else u.searchParams.set("p", k);
    history.replaceState(null, "", u.pathname + (u.search || "") );
  }

  tabs.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => show(b.dataset.p)));

  /* 주소에 ?p=addr 처럼 갈래가 적혀 오면 **먼저** 그 갈래로 갑니다 —
     관리자 확인(아래 await)이 끝날 때까지 To Me 화면이 잠깐 떠 있다가 넘어가던 것을 막습니다.
     관리자가 아니어서 그 갈래가 사라지면 맨 아래에서 To Me 로 되돌립니다. */
  /* 옛 주소(?p=orgs · ?p=sites)는 Websites 로 — 그 덩이까지 내려 줍니다 */
  const OLD = { orgs: ["web", "w-orgs"], sites: ["web", "w-sites"] };
  const raw = new URLSearchParams(location.search).get("p");
  const first = OLD[raw] ? OLD[raw][0] : raw;
  const jump = OLD[raw] ? OLD[raw][1] : "";
  if (first && panes[first]) show(first);

  /* 활동기관은 누구나 봅니다 — 바깥을 부르지 않으므로 곧바로 그립니다 */
  const okOrgs = initOrgs();
  /* 최신뉴스도 누구나 — 모아 둔 파일을 읽어 그리기만 합니다 */
  if (!initNews()) { const b = tabs.querySelector('button[data-p="news"]'); if (b) b.remove(); }

  /* 주소록·Sites 는 관리자에게만 열립니다.
     각 모듈이 스스로 판단해 아니면 자기 자리를 지웁니다. */
  const [okAddr, okSites, okTodo] = await Promise.all([
    initAddr().catch(() => false),
    initSites("sitesapp", "w-sites").catch(() => false),
    initTodo().catch(() => false),
  ]);

  const btn = (k) => tabs.querySelector(`button[data-p="${k}"]`);
  if (!okOrgs && !okSites) { const b = btn("web"); if (b) b.remove(); }
  if (okAddr)  btn("addr").hidden = false;  else btn("addr").remove();
  if (okTodo)  btn("todo").hidden = false;  else btn("todo").remove();
  /* 여섯째 단추 — 달력(APP 첫 화면)으로 돌아가기. 관리자에게만 (달력이 관리자 것이라). */
  const cal = document.getElementById("cCal");
  if (cal) { if (okTodo) cal.hidden = false; else cal.remove(); }

  // 주소에 ?p=addr 이 붙어 오면 그 갈래를 폅니다
  const want = first;
  show(want && panes[want] && btn(want) ? want : "tome");
  if (jump) { const el = document.getElementById(jump); if (el) el.scrollIntoView({ block: "start" }); }
}
