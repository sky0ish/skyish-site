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
comment on column public.sites.category is '학습 learn · 업무 work · 자료 data · 교육 edu · GRI gri · 학회 assoc · 생활 life · ETC etc';

alter table public.sites drop constraint if exists sites_cat_check;
alter table public.sites add  constraint sites_cat_check
  check (category in ('learn','work','data','edu','gri','assoc','life','etc'));

create index if not exists sites_cat_idx on public.sites (category, title);


-- ── 배우러 다니는 곳 심기 ──
--    이미 같은 주소가 있으면 건너뜁니다. 여러 번 실행해도 겹치지 않습니다.
--    (홈페이지에는 이 표가 없어도 붙박이로 보입니다. 여기 담기면
--     그때부터 이름·메모를 고치고 지울 수 있게 됩니다.)
insert into public.sites (title, url, category, note)
select v.title, v.url, v.category, v.note
  from (values
    ('한솔아카데미', 'https://bim.inup.co.kr/mypage/index.jsp?t=mypage', 'learn', '건축 · BIM — 내 강의실'),
    ('패스트캠퍼스', 'https://fastcampus.co.kr/me/course',               'learn', '수강 중인 강의'),
    ('클래스101',   'https://class101.net/ko/my-classes',              'learn', '내 클래스'),
    ('인프런',      'https://www.inflearn.com/my/courses',             'learn', '내 학습')
  ) as v(title, url, category, note)
 where not exists (select 1 from public.sites s where s.url = v.url);


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
  (select count(*) from public.sites)                             as 담긴_곳,
  (select count(*) from public.sites where category = 'learn')    as 학습;
