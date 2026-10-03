-- ─── 구글 달력 「늘 연결」 — 갱신 열쇠 보관함 ─────────────────
-- Supabase (skyish.kr 쪽, qmdovjlxfvinknuizelw) → SQL Editor 에서 한 번 실행합니다.
--
-- 구글이 주는 갱신 열쇠(refresh token)를 담아 두는 표입니다.
-- · 브라우저(anon·로그인한 사람)는 이 표를 **읽지도 쓰지도 못합니다** — 정책을 하나도 두지 않았습니다.
-- · 서버 함수 gcal-token (supabase/functions/gcal-token) 만 service role 로 다룹니다.
-- · 열쇠는 관리자 한 사람당 한 줄입니다.

create table if not exists public.gcal_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  google_email  text,
  refresh_token text not null,
  scope         text,
  updated_at    timestamptz not null default now()
);

alter table public.gcal_tokens enable row level security;

-- 정책 없음 = 브라우저에서는 0 줄로 보입니다. (지우지 마십시오)
revoke all on public.gcal_tokens from anon, authenticated;
