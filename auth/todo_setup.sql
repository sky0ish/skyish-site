-- ═══════════════════════════════════════════════════════════
--  해야할일 (Contact → 해야할일 탭)
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

create table if not exists public.todos (
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

alter table public.todos add column if not exists due     date;
alter table public.todos add column if not exists done_at timestamptz;
alter table public.todos add column if not exists star    boolean not null default false;
alter table public.todos add column if not exists sort    integer;

create index if not exists todos_order_idx on public.todos (done, star, sort, due, created_at);

alter table public.todos enable row level security;

drop policy if exists "admin reads todos"   on public.todos;
drop policy if exists "admin writes todos"  on public.todos;
drop policy if exists "admin updates todos" on public.todos;
drop policy if exists "admin deletes todos" on public.todos;

create policy "admin reads todos"   on public.todos
  for select using (public.is_admin());
create policy "admin writes todos"  on public.todos
  for insert with check (public.is_admin() and created_by = auth.uid());
create policy "admin updates todos" on public.todos
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes todos" on public.todos
  for delete using (public.is_admin());

create or replace function public.todos_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists todos_touch_trg on public.todos;
create trigger todos_touch_trg before update on public.todos
  for each row execute function public.todos_touch();
