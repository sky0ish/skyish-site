// ─── 그날 동경대에 남긴 내 기록 ──────────────────────────────
//
//  동문회 홈페이지(u-tokyo.kr)는 **다른 Supabase 프로젝트**를 씁니다.
//  그래서 여기에 연결을 하나 더 둡니다.
//
//  ■ 두 로그인이 서로를 밀어내지 않게
//    같은 브라우저에서 두 프로젝트에 로그인하려면 저장소 열쇠가 달라야 합니다.
//    개인 홈피는 "skyish-auth", 여기는 "skyish-utokyo-auth" 를 씁니다.
//    한 번 이어 두면 브라우저에 남아, 다시 열어도 그대로입니다.
//
//  ■ 비밀번호는 되도록 안 받습니다
//    동경대 계정은 **다른 분들의 자료가 담긴 사이트**의 열쇠입니다.
//    그 비밀번호가 개인 홈피(skyish.kr) 쪽을 지나가지 않도록,
//    메일로 온 여섯 자리 숫자로 잇는 길을 먼저 둡니다.
//    (메일이 안 오면 비밀번호로도 이을 수 있게 남겨 두었습니다)
//
//  ■ 글을 옮겨 오지 않습니다
//    제목만 보여 주고, 누르면 u-tokyo.kr 의 그 글로 갑니다.
//    개인 홈피에는 동문회 글이 한 줄도 저장되지 않습니다.
//
//  ■ 조용합니다
//    이어져 있지 않거나 그날 기록이 없으면 아무것도 그리지 않습니다.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* 동문회 프로젝트 — 이 열쇠는 홈페이지에 드러나도 되는 공개용입니다
   (u-tokyo.kr 이 이미 같은 값을 브라우저로 내려보내고 있습니다) */
const U_URL = "https://ojnukcciozchnsycxtfq.supabase.co";
const U_KEY = "sb_publishable_Sa7S4MKqYbC4gX76QTAjDw_qKqW8rR_";
export const SITE = "https://u-tokyo.kr";

export const ub = createClient(U_URL, U_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // 개인 홈피 로그인과 섞이지 않게 열쇠를 따로 씁니다
    storageKey: "skyish-utokyo-auth",
    storage: window.localStorage,
    // 이 창의 주소에서 로그인 흔적을 찾지 않습니다 (개인 홈피 것과 헷갈리지 않게)
    detectSessionInUrl: false,
  },
});

/** 동경대 쪽에 이어져 있는 사람 (없으면 null) */
export async function me() {
  try {
    const { data } = await ub.auth.getSession();
    return (data && data.session) ? data.session.user : null;
  } catch (e) { return null; }
}

/** ① 메일로 여섯 자리 숫자를 보냅니다 (비밀번호를 안 받는 길) */
export async function sendCode(email) {
  const { error } = await ub.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },   // 새 계정은 만들지 않습니다
  });
  if (error) throw error;
}

/** ② 메일로 온 숫자로 잇습니다 */
export async function verifyCode(email, token) {
  const { data, error } = await ub.auth.verifyOtp({
    email, token: String(token || "").trim(), type: "email",
  });
  if (error) throw error;
  return data.user;
}

/** 메일이 안 올 때를 위한 길 — 비밀번호로 잇기 */
export async function signIn(email, password) {
  const { data, error } = await ub.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/** 이 브라우저의 연결만 풉니다.
    scope 를 안 주면 기본이 "global" 이라 **다른 기기의 u-tokyo.kr 로그인까지**
    끊어 버립니다. 여기서 푸는 것은 이 창의 연결뿐이어야 합니다. */
export async function signOut() {
  try { await ub.auth.signOut({ scope: "local" }); } catch (e) {}
}

/* ── 그날 남긴 것 ─────────────────────────────────────────
   하루의 시작과 끝으로 잘라 냅니다. 서울 시각으로 봅니다. */
function dayRange(iso) {
  const from = new Date(iso + "T00:00:00+09:00");
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  return [from.toISOString(), to.toISOString()];
}

/**
 * 그날 내가 동경대 홈페이지에 남긴 것.
 * @returns { posts:[], comments:[], photos:[] }  — 이어져 있지 않으면 모두 빈 배열
 */
export async function dayRecords(iso) {
  const empty = { posts: [], comments: [], photos: [] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return empty;
  const user = await me();
  if (!user) return empty;
  const [a, b] = dayRange(iso);

  /* 셋을 한꺼번에 물어봅니다. 표가 없거나 막혀도 그 갈래만 비웁니다. */
  const ask = (q) => q.then((r) => (r.error ? [] : (r.data || []))).catch(() => []);
  const [posts, comments, photos] = await Promise.all([
    ask(ub.from("posts")
      .select("id,title,category,org,created_at")
      .eq("author_id", user.id).gte("created_at", a).lt("created_at", b)
      .order("created_at")),
    ask(ub.from("comments")
      .select("id,post_id,content,created_at")
      .eq("author_id", user.id).gte("created_at", a).lt("created_at", b)
      .order("created_at")),
    ask(ub.from("gallery_photos")
      // album_key·taken_at·org 이 있어야 그 사진이 든 앨범을 바로 열 수 있습니다
      .select("id,caption,category,album_key,taken_at,org,created_at")
      .eq("created_by", user.id).gte("created_at", a).lt("created_at", b)
      .order("created_at")),
  ]);
  return { posts, comments, photos };
}

/** 그 글로 가는 주소 (동문회 쪽 창으로) */
export const postUrl = (id, org) =>
  SITE + (org === "YB" ? "/YB" : "/OB") + "/post.html?id=" + encodeURIComponent(id);

/** 그 사진이 든 앨범으로 가는 주소.
    · cat 만 주면 그 갈래의 **첫 앨범**이 열립니다 — 늘 엉뚱한 앨범이었습니다.
    · 옛 'etc' 갈래는 화면에서 'daily' 로 접혀 있어 그대로 주면 못 찾습니다.
    · 앨범 열쇠가 없는 사진은 촬영 연도로 묶인 자동 앨범(갈래|연도)에 듭니다. */
export function albumUrl(p) {
  const o = p || {};
  const cat = (o.category === "etc") ? "daily" : (o.category || "");
  const side = (o.org === "YB") ? "/YB" : "/OB";
  const key = o.album_key || (cat + "|" + String(o.taken_at || "").slice(0, 4));
  return SITE + side + "/album.html?cat=" + encodeURIComponent(cat) +
         "&id=" + encodeURIComponent(key);
}

export const total = (r) =>
  (r ? r.posts.length + r.comments.length + r.photos.length : 0);
