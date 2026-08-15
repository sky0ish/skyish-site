-- ═══════════════════════════════════════════════════════════
--  MAP — 서울 지도 (핫플 · 도시건축 · 부동산)
--
--  세 갈래가 한 표를 함께 씁니다. grp 칸으로 나뉩니다.
--
--  실행 : Supabase(skyish 전용 프로젝트) → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql 을 실행해 두셔야 합니다 (profiles 표가 필요합니다)
--  여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════

-- ── 0) 승인 여부를 확인하는 함수 ──
--     관리자는 analysis_access 를 따로 켜 두지 않아도 승인된 것으로 봅니다.
--     (화면 쪽 판정과 같게 맞춘 것입니다 — seoul-map.js 의 canAdd)
create or replace function public.is_approved()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select analysis_access or is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

-- ── 1) 장소 표 ──
create table if not exists public.map_places (
  id           uuid primary key default gen_random_uuid(),
  grp          text not null default 'hot',   -- 갈래 : hot(핫플) · urban(도시건축) · estate(부동산)
  category     text not null default 'food',
  name         text not null,
  address      text not null,
  note         text,                    -- 이곳의 특징
  memory       text,                    -- 얽힌 기억
  image_url    text,                    -- 사진 (선택)
  storage_path text,
  lat          double precision not null,
  lng          double precision not null,
  post_id      uuid,
  org          text not null default 'ALL',
  owner_name   text,
  owner_admin  boolean not null default false,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

-- 이미 만들어 두셨던 분이라면 이 줄이 grp 칸을 더해 줍니다
alter table public.map_places add column if not exists grp text not null default 'hot';

create index if not exists map_places_grp_cat_idx
  on public.map_places (grp, category, created_at desc);

-- ── 2) 갈래·분류 규칙 (바꾸면 다시 실행하세요) ──
alter table public.map_places drop constraint if exists map_places_grp_check;
alter table public.map_places add  constraint map_places_grp_check
  check (grp in ('hot','urban','estate'));

alter table public.map_places drop constraint if exists map_places_category_check;
alter table public.map_places add  constraint map_places_category_check
  check (category in ('food','cafe','apt','arch','hot'));

-- ── 3) 열람·등록 권한 ──
--     보기   : 누구나
--     등록   : 로그인 + 승인된 회원, 본인 명의로만
--     수정·삭제 : 본인 또는 관리자
alter table public.map_places enable row level security;

drop policy if exists "read places" on public.map_places;
create policy "read places" on public.map_places for select using (true);

--     owner_admin 은 실제 관리자일 때만 참으로 넣을 수 있습니다.
--     (이 검사가 없으면 일반 회원이 관리자 명의로 장소를 올릴 수 있습니다)
drop policy if exists "insert places" on public.map_places;
create policy "insert places" on public.map_places for insert
  with check (
    public.is_approved()
    and created_by  = auth.uid()
    and owner_admin = public.is_admin()
  );

--     승인이 취소된 회원은 자기 글이라도 더는 고치거나 지울 수 없습니다.
drop policy if exists "update places" on public.map_places;
create policy "update places" on public.map_places for update
  using ((created_by = auth.uid() and public.is_approved()) or public.is_admin());

drop policy if exists "delete places" on public.map_places;
create policy "delete places" on public.map_places for delete
  using ((created_by = auth.uid() and public.is_approved()) or public.is_admin());


-- ═══════════════════════════════════════════════════════════
--  4) 사진 보관함
--
--     대시보드에서  Storage → New bucket
--       이름: map        Public bucket: 켜기(ON)
--     사진은 공개로 두고, 올리는 것만 회원으로 제한합니다.
--     그다음 아래를 실행하세요.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "map upload for members" on storage.objects;
create policy "map upload for members" on storage.objects for insert
  with check (bucket_id = 'map' and public.is_approved());

drop policy if exists "map manage own" on storage.objects;
create policy "map manage own" on storage.objects for delete
  using (bucket_id = 'map' and (owner = auth.uid() or public.is_admin()));
