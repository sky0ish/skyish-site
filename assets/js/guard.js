/* ------------------------------------------------------------------
   페이지 접근 제한 — 로그인·승인된 사람만 보게 합니다.

   쓰는 법: 보호할 페이지 <head> 안에 아래 한 줄을 넣습니다.
     <script type="module" src="assets/js/guard.js"></script>

   동작
     · 확인이 끝날 때까지 화면을 가려 내용이 스쳐 보이지 않게 합니다.
     · 로그인 안 했으면 auth/login.html 로 보내고, 로그인 후 원래 페이지로 돌아옵니다.
     · 로그인했지만 승인 전이면 안내만 보여 줍니다.
     · 한 번 로그인하면 토큰이 자동 갱신되어 계속 유지됩니다.
   ------------------------------------------------------------------ */
import { analysisAccess } from "../../auth/auth.js";

const veil = document.createElement("div");
veil.className = "guard-veil";
veil.textContent = "확인 중…";

function ensureAuthCss() {
  if (document.querySelector('link[href*="auth/auth.css"]')) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "auth/auth.css";
  document.head.appendChild(l);
}

function mountVeil() {
  ensureAuthCss();
  (document.body || document.documentElement).appendChild(veil);
}

function pending(profile) {
  veil.innerHTML =
    '<div class="authcard" style="text-align:center">' +
      "<h1>승인 대기 중</h1>" +
      '<p class="authlead">' +
        (profile && profile.name ? profile.name + "님, " : "") +
        "가입 신청이 접수되었습니다.<br>승인되면 이 페이지를 보실 수 있습니다." +
      "</p>" +
      '<p class="authalt"><a href="index.html">← 홈으로</a></p>' +
    "</div>";
}

function toLogin() {
  const here = location.pathname.split("/").pop() + location.search;
  location.replace("auth/login.html?next=" + encodeURIComponent("../" + here));
}

if (document.body) mountVeil();
else document.addEventListener("DOMContentLoaded", mountVeil);

try {
  const { state, profile } = await analysisAccess();
  if (state === "ok") {
    veil.remove();
  } else if (state === "pending") {
    if (!document.body) await new Promise((r) => document.addEventListener("DOMContentLoaded", r));
    mountVeil();
    pending(profile);
  } else {
    toLogin();
  }
} catch (e) {
  // 네트워크 오류 등으로 확인이 안 되면 막지 않고 통과시킵니다.
  // (자료 자체는 Supabase 쪽에서 다시 한 번 걸러집니다)
  console.warn("[guard] 확인 실패 — 통과 처리:", e);
  veil.remove();
}
