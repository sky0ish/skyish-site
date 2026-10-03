// ─── news-refresh — Contact 「NEWS」의 「모든 갈래 최신으로」 단추 ─────────────
//
//  홈피는 정적인 사이트라 브라우저에서 수집 프로그램(tools/news/collect.py)을 돌릴 수 없습니다.
//  그래서 이 서버 함수가 GitHub 의 「news」 워크플로(.github/workflows/news.yml — 매일 아침 도는 것과
//  같은 수집 로직)를 지금 바로 돌려 달라고 부탁합니다. 수집이 끝나면 워크플로가 결과를 올리고,
//  GitHub Pages 가 다시 배포되면 화면이 새 뉴스를 읽습니다.
//
//  부르는 법 (POST, 머리에 Supabase 로그인 열쇠 Authorization: Bearer <JWT>)
//    { action: "run" }      수집 시작
//    { action: "status" }   가장 최근 수집의 상태 { status, conclusion, created, url }
//
//  비밀값 (Supabase → Edge Functions → Secrets)
//    GH_NEWS_TOKEN   GitHub fine-grained 토큰 — 저장소 sky0ish/skyish-site 하나만, 권한 「Actions: Read and write」
//  관리자(profiles.is_admin)만 쓸 수 있습니다.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const REPO = "sky0ish/skyish-site";
const FLOW = "news.yml";
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

Deno.serve(async (req) => {
  const h = cors(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ error: "POST 만 받습니다" }, 405, h);

  const TOKEN = Deno.env.get("GH_NEWS_TOKEN");
  if (!TOKEN) return json({ error: "서버에 GH_NEWS_TOKEN 이 없습니다" }, 500, h);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
                             { auth: { persistSession: false } });

  // ① 누가 불렀나 — 관리자만
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who, error: werr } = await admin.auth.getUser(jwt);
  if (werr || !who?.user) return json({ error: "로그인이 필요합니다" }, 401, h);
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", who.user.id).maybeSingle();
  if (!prof?.is_admin) return json({ error: "관리자만 쓸 수 있습니다" }, 403, h);

  let body: { action?: string } = {};
  try { body = await req.json(); } catch (_) { /* 빈 몸 */ }

  const gh = (path: string, init: RequestInit = {}) => fetch("https://api.github.com/repos/" + REPO + path, {
    ...init,
    headers: { Authorization: "Bearer " + TOKEN, Accept: "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "skyish-news-refresh", ...(init.headers || {}) },
  });

  // ② 수집 시작
  if (body.action === "run") {
    // 이미 돌고 있으면 또 시작하지 않습니다
    const cur = await gh(`/actions/workflows/${FLOW}/runs?per_page=1`);
    const cj = await cur.json().catch(() => ({}));
    const last = (cj.workflow_runs || [])[0];
    if (last && last.status !== "completed") return json({ ok: true, already: true, created: last.created_at }, 200, h);
    const r = await gh(`/actions/workflows/${FLOW}/dispatches`, {
      method: "POST", body: JSON.stringify({ ref: "main" }), headers: { "Content-Type": "application/json" },
    });
    if (r.status !== 204) {
      const t = await r.text().catch(() => "");
      return json({ error: "GitHub 이 거절했습니다 (" + r.status + ") " + t.slice(0, 200) }, 502, h);
    }
    return json({ ok: true, started: new Date().toISOString() }, 200, h);
  }

  // ③ 가장 최근 수집의 상태
  if (body.action === "status") {
    const r = await gh(`/actions/workflows/${FLOW}/runs?per_page=1`);
    if (!r.ok) return json({ error: "GitHub 상태를 못 읽었습니다 (" + r.status + ")" }, 502, h);
    const j = await r.json();
    const x = (j.workflow_runs || [])[0];
    if (!x) return json({ ok: true, none: true }, 200, h);
    return json({ ok: true, status: x.status, conclusion: x.conclusion, created: x.created_at,
                  updated: x.updated_at, url: x.html_url }, 200, h);
  }

  return json({ error: "action 은 run · status 가운데 하나" }, 400, h);
});
