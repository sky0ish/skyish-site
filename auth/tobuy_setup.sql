-- ═══════════════════════════════════════════════════════════
--  살 것 목록 (Contact → To BUY 탭)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql (profiles · is_admin) 을 실행해 두셔야 합니다
--  여러 번 실행해도 안전합니다.
--
--  ※ 관리자만 보고 씁니다. 표가 없는 동안에는 화면이 브라우저 저장소에 두었다가,
--     표를 만든 뒤 「표로 옮기기」 로 넘깁니다.
-- ═══════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin
                         from public.profiles where id = auth.uid()), false) $$;

create table if not exists public.tobuys (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  done        boolean not null default false,   -- 완료 — 줄을 긋고 아래로
  star        boolean not null default false,   -- 중요 — 맨 위로
  due         date,                             -- 마감 (없어도 됩니다)
  done_at     timestamptz,                      -- 언제 끝냈는지 (완료 묶음의 차례)
  sort        integer,                          -- 손으로 정한 차례 (▲▼ · 끌어놓기)
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.tobuys add column if not exists due     date;
alter table public.tobuys add column if not exists done_at timestamptz;
alter table public.tobuys add column if not exists star    boolean not null default false;
alter table public.tobuys add column if not exists sort    integer;

create index if not exists tobuys_order_idx on public.tobuys (done, star, sort, due, created_at);

alter table public.tobuys enable row level security;

drop policy if exists "admin reads tobuys"   on public.tobuys;
drop policy if exists "admin writes tobuys"  on public.tobuys;
drop policy if exists "admin updates tobuys" on public.tobuys;
drop policy if exists "admin deletes tobuys" on public.tobuys;

create policy "admin reads tobuys"   on public.tobuys
  for select using (public.is_admin());
create policy "admin writes tobuys"  on public.tobuys
  for insert with check (public.is_admin() and created_by = auth.uid());
create policy "admin updates tobuys" on public.tobuys
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes tobuys" on public.tobuys
  for delete using (public.is_admin());

create or replace function public.tobuys_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists tobuys_touch_trg on public.tobuys;
create trigger tobuys_touch_trg before update on public.tobuys
  for each row execute function public.tobuys_touch();

-- ═══════════════════════════════════════════════════════════
--  장본 것 · 요리책 (To BUY 아래 「장본 것」·「만들 수 있는 요리」)
--  kind = 'item'  품목 하나 (cat: fruit · veg · food · etc)
--         'photo' 그날의 사진·영수증 미리보기 (thumb 는 작은 그림)
--         'book'  요리책 (data 에 레시피.json 통째로)
-- ═══════════════════════════════════════════════════════════
create table if not exists public.groceries (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'item',
  cat         text,
  name        text,
  price       integer,
  bought_on   date,
  src         text,             -- 어느 파일에서 읽었나 (같은 것을 두 번 읽지 않게)
  thumb       text,
  data        jsonb,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists groceries_day_idx on public.groceries (bought_on desc);

alter table public.groceries enable row level security;
drop policy if exists "admin reads groceries"   on public.groceries;
drop policy if exists "admin writes groceries"  on public.groceries;
drop policy if exists "admin updates groceries" on public.groceries;
drop policy if exists "admin deletes groceries" on public.groceries;
create policy "admin reads groceries"   on public.groceries for select using (public.is_admin());
create policy "admin writes groceries"  on public.groceries for insert with check (public.is_admin() and created_by = auth.uid());
create policy "admin updates groceries" on public.groceries for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes groceries" on public.groceries for delete using (public.is_admin());
