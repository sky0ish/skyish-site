// ─── Contact 의 세 갈래 ─────────────────────────────────────
//
//   To Me    문의 보내기 — 누구나
//   주소록    내 컴퓨터의 명함첩·동문 명부 — 관리자만
//   Sites    자주 드나드는 곳 — 관리자만
//
// 관리자가 아니면 뒤의 두 갈래는 단추째 사라집니다.
import { initAddr } from "./addressbook.js?v=202608311600";
import { initSites } from "./sites.js?v=202608311600";

export async function initContactTabs() {
  const tabs = document.getElementById("cTabs");
  if (!tabs) return;

  const panes = {
    tome:  document.querySelector(".contact-grid"),
    addr:  document.getElementById("addrsec"),
    sites: document.getElementById("sitesec"),
  };

  function show(k) {
    tabs.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("on", b.dataset.p === k));
    Object.entries(panes).forEach(([p, el]) => {
      if (!el) return;
      // .contact-grid 는 section 이 아니라 격자라 hidden 대신 보임새로 감춥니다
      if (p === "tome") el.style.display = (k === "tome") ? "" : "none";
      else el.hidden = (k !== p);
    });
    const u = new URL(location.href);
    if (k === "tome") u.searchParams.delete("p"); else u.searchParams.set("p", k);
    history.replaceState(null, "", u.pathname + (u.search || "") );
  }

  tabs.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => show(b.dataset.p)));

  /* 주소록·Sites 는 관리자에게만 열립니다.
     각 모듈이 스스로 판단해 아니면 자기 자리를 지웁니다. */
  const [okAddr, okSites] = await Promise.all([
    initAddr().catch(() => false),
    initSites().catch(() => false),
  ]);

  const btn = (k) => tabs.querySelector(`button[data-p="${k}"]`);
  if (okAddr)  btn("addr").hidden = false;  else btn("addr").remove();
  if (okSites) btn("sites").hidden = false; else btn("sites").remove();

  // 주소에 ?p=addr 이 붙어 오면 그 갈래를 폅니다
  const want = new URLSearchParams(location.search).get("p");
  show(want && panes[want] && btn(want) ? want : "tome");
}
