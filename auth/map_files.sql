-- ═══════════════════════════════════════════════════════════
--  내 지도 파일 심기 (map_files)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/map_setup.sql (is_admin 함수를 씁니다)
--  여러 번 실행해도 안전합니다.
--
--  MAP 의 「KML·KMZ·SHP 불러오기」 로 올린 지도를 여기 담아
--  새로고침해도, 다른 기기에서도 계속 보이게 합니다.
--  KML 폴더 하나(예: 한식) = 줄 하나입니다.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.map_files (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,               -- 층 이름 (KML 폴더 이름 등)
  src_name   text,                        -- 어느 파일에서 왔는지
  grp        text not null default 'all', -- 어느 화면에 붙는지 (hot·urban·… / all=종합)
  color      text,                        -- 그릴 때 쓰는 빛깔
  geojson    jsonb not null,              -- 도형 그 자체
  count      integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists map_files_grp_idx on public.map_files (grp, created_at);

-- 보기: 누구나 · 올리고 지우기: 관리자만 (개인 지도라서)
alter table public.map_files enable row level security;

drop policy if exists "read map files" on public.map_files;
create policy "read map files" on public.map_files
  for select using (true);

drop policy if exists "admin writes map files" on public.map_files;
create policy "admin writes map files" on public.map_files
  for insert with check (public.is_admin());

drop policy if exists "admin deletes map files" on public.map_files;
create policy "admin deletes map files" on public.map_files
  for delete using (public.is_admin());


-- 확인
select count(*) as 심긴_층 from public.map_files;
