-- ═══════════════════════════════════════════════════════════
--  Sites — 자주 드나드는 곳
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql · auth/roles_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  CONTACT 화면의 「Sites」 갈래에서 씁니다.
--  관리자만 보고 씁니다 — 개인 즐겨찾기라서.
-- ═══════════════════════════════════════════════════════════


create table if not exists public.sites (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  url         text not null,
  category    text not null default 'work',
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

comment on table  public.sites          is '자주 드나드는 곳 (CONTACT → Sites)';
comment on column public.sites.category is '업무 work · 자료 data · 교육 edu · GRI gri · 학회 assoc · 생활 life · ETC etc';

alter table public.sites drop constraint if exists sites_cat_check;
alter table public.sites add  constraint sites_cat_check
  check (category in ('work','data','edu','gri','assoc','life','etc'));

create index if not exists sites_cat_idx on public.sites (category, title);


-- ── 관리자만 보고 씁니다 ──
alter table public.sites enable row level security;

drop policy if exists "admin reads sites"   on public.sites;
create policy "admin reads sites" on public.sites
  for select using (public.is_admin());

drop policy if exists "admin writes sites"  on public.sites;
create policy "admin writes sites" on public.sites
  for insert with check (public.is_admin());

drop policy if exists "admin updates sites" on public.sites;
create policy "admin updates sites" on public.sites
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin deletes sites" on public.sites;
create policy "admin deletes sites" on public.sites
  for delete using (public.is_admin());


-- ═══════════════════════════════════════════════════════════
--  확인 — 표 1 · 규칙 4 가 나와야 합니다
-- ═══════════════════════════════════════════════════════════

select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='sites')          as 표,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='sites')             as 규칙,
  (select count(*) from public.sites)                             as 담긴_곳;
