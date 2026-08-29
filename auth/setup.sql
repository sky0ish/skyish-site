-- ═══════════════════════════════════════════════════════════
--  skyish.kr 회원·권한 초기 설정  (Supabase 전용 프로젝트)
--
--  실행: Supabase 대시보드 → SQL Editor → New query
--        아래 전체를 붙여넣고 Run
--
--  여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════

-- ── 1) 회원 프로필 ────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  name            text,
  affiliation     text,                                   -- 소속 (승인 판단용)
  analysis_access boolean not null default false,         -- 열람 승인 여부
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ── 2) 행 단위 보안 : 본인 것만 보고, 권한은 스스로 못 바꿈 ──
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and analysis_access = (select analysis_access from public.profiles where id = auth.uid())
    and is_admin        = (select is_admin        from public.profiles where id = auth.uid())
  );

-- ── 3) 가입하면 프로필 자동 생성 ──────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, affiliation)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'affiliation', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 이 SQL 실행 전에 만든 계정이 있으면 프로필을 채워 넣습니다
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);


-- ═══════════════════════════════════════════════════════════
--  4) 분석 자료 보관함 (비공개 버킷)
--
--     먼저 대시보드에서  Storage → New bucket
--       이름: analysis        Public bucket: 반드시 꺼짐(OFF)
--     그다음 아래를 실행하세요.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "analysis read for approved" on storage.objects;
create policy "analysis read for approved" on storage.objects
  for select using (
    bucket_id = 'analysis'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.analysis_access
    )
  );

drop policy if exists "analysis write for admin" on storage.objects;
create policy "analysis write for admin" on storage.objects
  for all using (
    bucket_id = 'analysis'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );


-- ═══════════════════════════════════════════════════════════
--  5) 관리자가 쓰는 명령
-- ═══════════════════════════════════════════════════════════

-- ▸ 나에게 관리자·열람 권한 주기 (이메일을 본인 것으로)
-- update public.profiles
--    set analysis_access = true, is_admin = true
--  where email = 'skyish76@gmail.com';

-- ▸ 승인 대기자 보기
-- select email, name, affiliation, created_at
--   from public.profiles
--  where analysis_access = false
--  order by created_at desc;

-- ▸ 특정 회원 승인
-- update public.profiles set analysis_access = true where email = 'someone@example.com';

-- ▸ 승인 취소
-- update public.profiles set analysis_access = false where email = 'someone@example.com';
