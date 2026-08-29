-- ═══════════════════════════════════════════════════════════
--  BLOG — 나만 보는 기록장
--
--  갈래 : schedule(Schedule) · diary(Diary) · contacts(연락망)
--         people(사람들) · minutes(회의록) · daily(일상) · etc(ETC)
--  회의록 말머리 : GRI · 도시일반 · 건축일반 · 주거 · 균형발전 · 산업 · ETC
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql 을 실행해 두셔야 합니다
--  여러 번 실행해도 안전합니다.
--
--  ※ 이 표는 관리자만 보고 쓸 수 있습니다.
--     로그인하지 않은 사람은 물론, 승인된 일반 회원도 볼 수 없습니다.
-- ═══════════════════════════════════════════════════════════

-- 관리자 확인 함수 (없으면 만듭니다)
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin
                         from public.profiles where id = auth.uid()), false) $$;


-- ── 1) 기록 표 ────────────────────────────────────────────────

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'diary',
  title       text not null,
  body        text,
  event_date  date,            -- 달력에 놓일 날짜 (글에서 찾아 자동으로 채웁니다)
  tag         text,            -- 회의록 말머리 (GRI · 도시일반 · 건축일반 …)
  place       text,            -- 장소
  people      text,            -- 만난 사람
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 표를 이미 만들어 두셨던 분을 위해
alter table public.notes add column if not exists event_date date;
alter table public.notes add column if not exists place      text;
alter table public.notes add column if not exists people     text;
alter table public.notes add column if not exists updated_at timestamptz not null default now();
alter table public.notes add column if not exists tag        text;

create index if not exists notes_cat_idx  on public.notes (category, event_date desc, created_at desc);
create index if not exists notes_date_idx on public.notes (event_date);

-- ── 2) 갈래 규칙 (갈래를 바꾸면 다시 실행하세요) ──
alter table public.notes drop constraint if exists notes_cat_check;
alter table public.notes add  constraint notes_cat_check
  check (category in ('schedule','diary','contacts','people','minutes','daily','etc'));


-- ── 3) 권한 — 관리자만 ────────────────────────────────────────

alter table public.notes enable row level security;

drop policy if exists "admin reads notes"   on public.notes;
drop policy if exists "admin writes notes"  on public.notes;
drop policy if exists "admin updates notes" on public.notes;
drop policy if exists "admin deletes notes" on public.notes;

create policy "admin reads notes"   on public.notes
  for select using (public.is_admin());
create policy "admin writes notes"  on public.notes
  for insert with check (public.is_admin() and created_by = auth.uid());
create policy "admin updates notes" on public.notes
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes notes" on public.notes
  for delete using (public.is_admin());


-- ── 4) 고친 때를 저절로 남기기 ──
create or replace function public.notes_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists notes_touch_trg on public.notes;
create trigger notes_touch_trg before update on public.notes
  for each row execute function public.notes_touch();


-- ═══════════════════════════════════════════════════════════
--  5) 잘 되었는지 확인
-- ═══════════════════════════════════════════════════════════

select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='notes')                  as 기록표,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='notes')                     as 권한규칙,
  (select count(*) from public.notes)                                     as 적어둔_글;

--  기대값 : 기록표 1 · 권한규칙 4
--  (적어둔_글 은 관리자로 로그인한 상태에서만 실제 수가 보입니다)
