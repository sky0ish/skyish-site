/* Decap CMS — GitHub OAuth 2단계
 *
 * GitHub 가 code 를 들고 여기로 돌아옵니다.
 * code 를 access token 으로 바꾼 뒤, 팝업을 연 CMS 창으로 postMessage 하여 넘겨줍니다.
 * (Decap 이 기대하는 메시지 규약: "authorization:github:success:{...}")
 */

const html = (body) =>
  new Response(`<!doctype html><meta charset="utf-8"><title>인증</title>${body}`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });

const errorPage = (msg) =>
  html(`<p style="font:15px/1.7 system-ui;padding:2rem">로그인 실패: ${escapeHtml(msg)}</p>`);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export default async (req) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return errorPage("GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET 환경변수가 없습니다.");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code) return errorPage(url.searchParams.get("error_description") || "code 가 없습니다.");

  const expected = readCookie(req.headers.get("cookie"), "decap_oauth_state");
  if (!expected || expected !== state) {
    return errorPage("state 불일치 — 처음부터 다시 로그인해 주세요.");
  }

  let token;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${url.origin}/callback`
      })
    });
    const data = await res.json();
    if (data.error) return errorPage(data.error_description || data.error);
    token = data.access_token;
  } catch (e) {
    return errorPage("토큰 교환 중 오류: " + e.message);
  }
  if (!token) return errorPage("access_token 을 받지 못했습니다.");

  const payload = JSON.stringify({ token, provider: "github" });

  // Decap 규약: 부모창이 "authorizing:github" 를 받은 뒤 결과 메시지를 기다립니다.
  return html(`<body style="font:15px/1.7 system-ui;padding:2rem">로그인 처리 중…</body>
<script>
(function () {
  var payload = ${JSON.stringify("authorization:github:success:" + payload)};
  function relay(e) {
    if (!window.opener) return;
    window.opener.postMessage(payload, e.origin);
    window.removeEventListener("message", relay, false);
    setTimeout(function () { window.close(); }, 300);
  }
  window.addEventListener("message", relay, false);
  if (window.opener) window.opener.postMessage("authorizing:github", "*");
  else document.body.textContent = "이 창은 CMS 에서 열어야 합니다.";
})();
</script>`);
};
