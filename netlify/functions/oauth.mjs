/* Decap CMS — GitHub OAuth 1단계
 *
 * Decap 이 팝업으로 https://<사이트>/oauth?provider=github&scope=repo 를 엽니다.
 * 여기서 GitHub 인증 페이지로 넘기고, 돌아오는 곳은 /callback 입니다.
 *
 * 필요한 환경변수 (Netlify → Site configuration → Environment variables):
 *   GITHUB_CLIENT_ID
 *   GITHUB_CLIENT_SECRET   (callback.mjs 에서 사용)
 */

export default async (req) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response(
      "GITHUB_CLIENT_ID 환경변수가 설정되지 않았습니다.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "repo,user";

  // CSRF 방지용 state — 쿠키에 담아 두었다가 callback 에서 대조
  const state = crypto.randomUUID().replace(/-/g, "");

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("redirect_uri", `${url.origin}/callback`);

  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "set-cookie": `decap_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
      "cache-control": "no-store"
    }
  });
};
