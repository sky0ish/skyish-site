/* ─── 공용 인증 모듈 (skyish.kr) ───────────────────────
   utokyo-kr 과 같은 Supabase 프로젝트를 쓰지만, 브라우저 저장소 키는
   도메인별로 따로 두어 서로 간섭하지 않게 합니다.
   ------------------------------------------------------ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_KEY, ANALYSIS_BUCKET } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: "skyish-auth",
    flowType: "pkce",
  },
});

/* 현재 로그인 사용자 (없으면 null) */
export async function currentUser() {
  const { data: { session } } = await sb.auth.getSession();
  return session ? session.user : null;
}

/* 내 프로필 (profiles 테이블) */
export async function myProfile() {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).single();
  return data;
}

/* 분석 게시판을 볼 수 있는 상태인지
   반환: { state: "guest" | "pending" | "ok", profile }
     guest   — 로그인 안 함
     pending — 가입했지만 아직 승인 전
     ok      — 승인 완료 */
export async function analysisAccess() {
  const user = await currentUser();
  if (!user) return { state: "guest", profile: null };
  const profile = await myProfile();
  if (!profile) return { state: "pending", profile: null };
  return { state: profile.analysis_access ? "ok" : "pending", profile };
}

/* 비공개 버킷에서 JSON 자료 받기 (승인된 사용자만 성공) */
export async function loadAnalysisJson(path) {
  const { data, error } = await sb.storage.from(ANALYSIS_BUCKET).download(path);
  if (error) throw new Error(error.message || "자료를 받을 수 없습니다.");
  return JSON.parse(await data.text());
}

export async function logout(to) {
  await sb.auth.signOut();
  location.href = to || "login.html";
}

/* 폼 아래 메시지 */
export function showMsg(el, text, ok = false) {
  el.textContent = text;
  el.className = "authmsg " + (ok ? "is-ok" : "is-err");
  el.hidden = false;
}
