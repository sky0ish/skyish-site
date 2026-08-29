-- ═══════════════════════════════════════════════════════════
--  회원 관리 화면을 쓰기 위한 권한 규칙
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql 을 실행해 두셔야 합니다
--  여러 번 실행해도 안전합니다.
--
--  지금은 profiles 에 '본인 것만 보기' 규칙만 있어서
--  관리자도 다른 회원을 볼 수 없습니다. 그것을 열어 줍니다.
-- ═══════════════════════════════════════════════════════════

-- 관리자 확인 함수 (없으면 만듭니다)
--   security definer 라 이 함수 안에서는 RLS 를 거치지 않습니다.
--   그래서 profiles 규칙 안에서 불러도 제자리를 맴돌지 않습니다.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin
                         from public.profiles where id = auth.uid()), false) $$;

-- ── 관리자는 모든 회원을 볼 수 있습니다 ──
drop policy if exists "admin reads all profiles" on public.profiles;
create policy "admin reads all profiles" on public.profiles
  for select using (public.is_admin());

-- ── 관리자는 승인·관리자 여부를 바꿀 수 있습니다 ──
drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());


-- ═══════════════════════════════════════════════════════════
--  확인 — 관리자로 로그인한 상태에서 돌리면 전체 회원이 보입니다
-- ═══════════════════════════════════════════════════════════

select
  (select count(*) from pg_policies
     where schemaname='public' and tablename='profiles')        as 권한규칙_개수,
  (select count(*) from public.profiles)                        as 회원_수,
  (select count(*) from public.profiles where analysis_access)  as 승인됨,
  (select count(*) from public.profiles where is_admin)         as 관리자;

--  기대값 : 권한규칙_개수 4 (본인보기·본인고치기·관리자보기·관리자고치기)
