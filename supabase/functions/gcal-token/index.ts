// ─── gcal-token — 구글 달력 「로그아웃할 때까지 늘 연결」 ─────────────
//
//  브라우저만으로는 구글이 1시간짜리 열쇠밖에 주지 않습니다. 그래서
//  처음 한 번 받은 **갱신 열쇠(refresh token)** 를 이 서버 함수가 간직해 두고,
//  홈피가 부를 때마다 새 1시간 열쇠를 받아 건네줍니다. 팝업이 없습니다.
//
//  부르는 법 (POST, 머리에 Supabase 로그인 열쇠 Authorization: Bearer <JWT>)
//    { action: "exchange", code }   처음 잇기 — 구글이 준 code 를 갱신 열쇠로 바꿔 간직
//    { action: "refresh" }          새 1시간 열쇠 받기
//    { action: "forget" }           끊기 — 구글에 반납하고 지움
//
//  비밀값 (Supabase → Edge Functions → Secrets)
//    GOOGLE_CLIENT_ID      auth/config.js 의 GCAL_CLIENT_ID 와 같은 값
//    GOOGLE_CLIENT_SECRET  구글 클라우드 콘솔 → 그 OAuth 클라이언트의 「클라이언트 보안 비밀번호」
//  (SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 저절로 넣어 줍니다)
//
//  관리자(profiles.is_admin)만 쓸 수 있습니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ORIGINS = [/^https:\/\/(www\.)?skyish\.kr$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

function cors(origin: string | null) {
  const ok = origin && ORIGINS.some((r) => r.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://skyish.kr",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const json = (body: unknown, status: number, h: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json" } });

async function google(params: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ error: "POST 만 받습니다" }, 405, h);

  const CID = Deno.env.get("GOOGLE_CLIENT_ID");
  const SEC = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!CID || !SEC) return json({ error: "서버에 GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET 이 없습니다" }, 500, h);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
                             { auth: { persistSession: false } });

  // ① 누가 불렀나 — Supabase 로그인 열쇠로 확인하고, 관리자만
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who, error: werr } = await admin.auth.getUser(jwt);
  if (werr || !who?.user) return json({ error: "로그인이 필요합니다" }, 401, h);
  const uid = who.user.id;
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", uid).maybeSingle();
  if (!prof?.is_admin) return json({ error: "관리자만 쓸 수 있습니다" }, 403, h);

  let body: { action?: string; code?: string } = {};
  try { body = await req.json(); } catch (_) { /* 빈 몸 */ }

  // ② 처음 잇기 — code → 갱신 열쇠
  if (body.action === "exchange") {
    if (!body.code) return json({ error: "code 가 없습니다" }, 400, h);
    const g = await google({
      code: body.code, client_id: CID, client_secret: SEC,
      redirect_uri: "postmessage", grant_type: "authorization_code",
    });
    if (!g.ok) return json({ error: "구글이 거절했습니다: " + (g.j.error_description || g.j.error || g.status) }, 400, h);
    let email = "";
    try { email = JSON.parse(atob(String(g.j.id_token || "").split(".")[1] || "")).email || ""; } catch (_) { /* 없음 */ }
    if (g.j.refresh_token) {
      const { error } = await admin.from("gcal_tokens").upsert({
        user_id: uid, refresh_token: g.j.refresh_token, scope: g.j.scope || "",
        google_email: email, updated_at: new Date().toISOString(),
      });
      if (error) return json({ error: "보관하지 못했습니다: " + error.message }, 500, h);
    }
    if (!g.j.refresh_token) {
      /* 이 계정이 예전에 (서버 없이) 허락해 둔 적이 있으면 구글이 갱신 열쇠를 다시 주지 않습니다.
         이미 간직한 것이 없으면 허락을 한 번 거두어, 다음에 누를 때 새로 받게 합니다. */
      const { data: had } = await admin.from("gcal_tokens").select("user_id").eq("user_id", uid).maybeSingle();
      if (!had) {
        await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(g.j.access_token),
                    { method: "POST" }).catch(() => {});
        return json({ error: "구글이 갱신 열쇠를 주지 않아 예전 허락을 거두었습니다 — 「구글 달력 잇기」 를 한 번 더 눌러 주세요",
                      again: true }, 409, h);
      }
    }
    return json({ access_token: g.j.access_token, expires_in: g.j.expires_in || 3600,
                  kept: !!g.j.refresh_token, email }, 200, h);
  }

  // ③ 새 1시간 열쇠
  if (body.action === "refresh") {
    const { data: row } = await admin.from("gcal_tokens").select("refresh_token,google_email").eq("user_id", uid).maybeSingle();
    if (!row) return json({ error: "아직 이어 두지 않았습니다", relink: true }, 404, h);
    const g = await google({
      refresh_token: row.refresh_token, client_id: CID, client_secret: SEC, grant_type: "refresh_token",
    });
    if (!g.ok) {
      // 구글에서 허락을 거두었거나 열쇠가 만료됨 — 지우고 다시 이으라고 알립니다
      if (g.j.error === "invalid_grant") await admin.from("gcal_tokens").delete().eq("user_id", uid);
      return json({ error: "구글이 갱신을 거절했습니다: " + (g.j.error || g.status), relink: g.j.error === "invalid_grant" }, 401, h);
    }
    return json({ access_token: g.j.access_token, expires_in: g.j.expires_in || 3600, email: row.google_email }, 200, h);
  }

  // ④ 끊기
  if (body.action === "forget") {
    const { data: row } = await admin.from("gcal_tokens").select("refresh_token").eq("user_id", uid).maybeSingle();
    if (row) {
      await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(row.refresh_token),
                  { method: "POST" }).catch(() => {});
      await admin.from("gcal_tokens").delete().eq("user_id", uid);
    }
    return json({ ok: true }, 200, h);
  }

  return json({ error: "action 은 exchange · refresh · forget 가운데 하나" }, 400, h);
});
