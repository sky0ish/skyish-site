-- ═══════════════════════════════════════════════════════════
--  skyish.kr 분석 게시판 접근 권한 설정
--  실행: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
--
--  utokyo-kr 과 같은 프로젝트를 쓰므로, 기존 profiles 테이블을
--  건드리지 않고 컬럼만 덧붙입니다. 동문회 회원 승인(approved)과
--  분석자료 열람 권한(analysis_access)은 서로 별개입니다.
-- ═══════════════════════════════════════════════════════════

-- 1) 분석 게시판 열람 권한 컬럼 (기본값 false = 승인 전)
alter table public.profiles
  add column if not exists analysis_access boolean not null default false;

-- 소속 (승인 판단용, 선택 입력)
alter table public.profiles
  add column if not exists affiliation text;

-- 2) 본인이 스스로 권한을 올리지 못하게 막기
--    (기존 update 정책을 분석 권한까지 포함해 다시 만듭니다)
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and approved        = (select approved        from public.profiles where id = auth.uid())
    and is_admin        = (select is_admin        from public.profiles where id = auth.uid())
    and analysis_access = (select analysis_access from public.profiles where id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════
-- 3) 분석 자료 보관함 (비공개 버킷)
--
--    먼저 대시보드에서 Storage → New bucket → 이름 analysis,
--    Public bucket 은 반드시 꺼둔 상태로 만드세요.
--    그다음 아래 정책을 실행합니다.
-- ═══════════════════════════════════════════════════════════

-- 승인된 사람만 파일을 내려받을 수 있음
drop policy if exists "analysis read for approved" on storage.objects;
create policy "analysis read for approved" on storage.objects
  for select using (
    bucket_id = 'analysis'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.analysis_access
    )
  );

-- 업로드·수정·삭제는 관리자만
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
-- 4) 회원 승인하기 (관리자가 실행)
--
--    아래 이메일을 바꿔 실행하면 그 사람이 분석 게시판을 볼 수 있습니다.
--    대시보드 Table Editor → profiles 에서 체크박스로 켜도 됩니다.
-- ═══════════════════════════════════════════════════════════
-- update public.profiles set analysis_access = true where email = 'someone@example.com';

-- 승인 대기자 확인
-- select email, name, affiliation, created_at
--   from public.profiles where analysis_access = false order by created_at desc;
