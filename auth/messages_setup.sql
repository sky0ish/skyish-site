-- ═══════════════════════════════════════════════════════════
--  받은 메시지 (Contact → To Me 폼)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql (profiles · is_admin) 을 실행해 두셔야 합니다
--  여러 번 실행해도 안전합니다.
--
--  ※ 누구나(로그인 없이도) 남길 수 있고, 읽고 지우는 것은 관리자만 합니다.
--     이 표가 있으면 To Me 의 Send 가 메일 앱을 열지 않고 여기에 바로 남깁니다.
-- ═══════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin
                         from public.profiles where id = auth.uid()), false) $$;

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 200),
  subject     text check (char_length(subject) <= 200),
  message     text not null check (char_length(message) between 1 and 5000),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists messages_new_idx on public.messages (created_at desc);

alter table public.messages enable row level security;

drop policy if exists "anyone leaves a message" on public.messages;
drop policy if exists "admin reads messages"    on public.messages;
drop policy if exists "admin updates messages"  on public.messages;
drop policy if exists "admin deletes messages"  on public.messages;

-- 남기기는 누구나 (anon 키로도) — 다만 위의 길이 제한을 지켜야 합니다
create policy "anyone leaves a message" on public.messages
  for insert to anon, authenticated with check (true);
create policy "admin reads messages"   on public.messages
  for select using (public.is_admin());
create policy "admin updates messages" on public.messages
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes messages" on public.messages
  for delete using (public.is_admin());
