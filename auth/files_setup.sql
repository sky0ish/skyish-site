-- ═══════════════════════════════════════════════════════════
--  기록에 파일 붙이기 (My WAY…)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/notes_setup.sql · auth/roles_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  ※ 보관함 만들기
--     Storage → New bucket → 이름: files → Public bucket: 끄기(비공개)
--     그다음 이 파일을 실행하세요.
-- ═══════════════════════════════════════════════════════════


-- ── 1) 붙인 파일과 뽑아낸 글을 담을 칸 ──
alter table public.notes add column if not exists files   jsonb  not null default '[]'::jsonb;
alter table public.notes add column if not exists extract text;

comment on column public.notes.files   is '붙인 파일 목록 [{name,path,type,size}]';
comment on column public.notes.extract is '엑셀·PDF 에서 뽑아낸 글 (내 이름이 든 줄 우선)';


-- ── 2) 파일 보관함 권한 ──
--     보기·올리기·지우기 모두 관리자만.
--     기록 자체가 관리자 전용이므로 붙임 파일도 같게 둡니다.

drop policy if exists "files read for admin"   on storage.objects;
create policy "files read for admin" on storage.objects
  for select using (bucket_id = 'files' and public.is_admin());

drop policy if exists "files write for admin"  on storage.objects;
create policy "files write for admin" on storage.objects
  for insert with check (bucket_id = 'files' and public.is_admin());

drop policy if exists "files delete for admin" on storage.objects;
create policy "files delete for admin" on storage.objects
  for delete using (bucket_id = 'files' and public.is_admin());


-- ═══════════════════════════════════════════════════════════
--  확인
-- ═══════════════════════════════════════════════════════════

select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='notes'
       and column_name in ('files','extract'))              as 새로_생긴_칸,
  (select count(*) from storage.buckets where id='files')   as 파일보관함,
  (select count(*) from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname like 'files %')                       as 보관함_권한;

--  기대값 : 새로_생긴_칸 2 · 파일보관함 1 · 보관함_권한 3
--  파일보관함 이 0 이면 Storage 에서 files 보관함을 먼저 만들어 주세요.
