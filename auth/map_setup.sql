-- ═══════════════════════════════════════════════════════════
--  MAP — 지도 (핫플 · 도시건축 · 부동산 · 여행 · 일상 · 기타)
--
--  여섯 갈래가 표 하나를 함께 씁니다. grp 칸으로 나뉩니다.
--    hot    핫플        map.html?g=hot
--    urban  도시건축    map.html?g=urban
--    estate 부동산      map.html?g=estate
--    trip   여행        map.html?g=trip
--    daily  일상        map.html?g=daily
--    etc    기타        map.html?g=etc
--
--  실행 : Supabase(skyish 전용 프로젝트) → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql 을 실행해 두셔야 합니다 (profiles 표가 필요합니다)
--  여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════


-- ── 0) 승인 여부를 확인하는 함수 ──────────────────────────────
--     관리자는 analysis_access 를 따로 켜 두지 않아도 승인된 것으로 봅니다.
--     (화면 쪽 판정과 같게 맞춘 것입니다 — seoul-map.js 의 canAdd)

create or replace function public.is_approved()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select analysis_access or is_admin
                         from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin
                         from public.profiles where id = auth.uid()), false) $$;


-- ── 1) 장소 표 ────────────────────────────────────────────────

create table if not exists public.map_places (
  id           uuid primary key default gen_random_uuid(),
  grp          text not null default 'hot',   -- 갈래 : hot · urban · estate
  category     text not null default 'food',  -- 분류 : food · cafe · apt · arch · hot
  name         text not null,
  address      text not null,
  note         text,                          -- 이곳의 특징
  memory       text,                          -- 얽힌 기억
  image_url    text,                          -- 사진 (선택)
  storage_path text,                          -- 사진 보관함 안의 자리
  lat          double precision not null,
  lng          double precision not null,
  post_id      uuid,                          -- (지금은 쓰지 않습니다 — 게시판 연결용)
  org          text not null default 'ALL',   -- (지금은 쓰지 않습니다 — 도쿄판의 흔적)
  owner_name   text,                          -- 올린 사람 이름 (관리자는 비워 둡니다)
  owner_admin  boolean not null default false,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

-- 표를 이미 만들어 두셨던 분을 위해 — 없으면 더하고, 있으면 그대로 둡니다
alter table public.map_places add column if not exists grp text not null default 'hot';

create index if not exists map_places_grp_cat_idx
  on public.map_places (grp, category, created_at desc);


-- ── 2) 갈래·분류 규칙 (값을 바꾸면 이 부분을 다시 실행하세요) ──

alter table public.map_places drop constraint if exists map_places_grp_check;
alter table public.map_places add  constraint map_places_grp_check
  check (grp in ('hot','urban','estate','trip','daily','etc'));

alter table public.map_places drop constraint if exists map_places_category_check;
alter table public.map_places add  constraint map_places_category_check
  check (category in ('food','cafe','apt','arch','hot'));


-- ── 3) 열람·등록 권한 ─────────────────────────────────────────
--     보기      : 누구나
--     등록      : 승인된 회원이, 본인 명의로만
--     수정·삭제 : 승인 상태인 본인, 또는 관리자

alter table public.map_places enable row level security;

drop policy if exists "read places" on public.map_places;
create policy "read places" on public.map_places
  for select using (true);

--     owner_admin 은 실제 관리자일 때만 참으로 넣을 수 있습니다.
--     이 검사가 없으면 일반 회원이 관리자 명의로 장소를 올릴 수 있습니다.
drop policy if exists "insert places" on public.map_places;
create policy "insert places" on public.map_places
  for insert with check (
    public.is_approved()
    and created_by  = auth.uid()
    and owner_admin = public.is_admin()
  );

--     승인이 취소된 회원은 자기 글이라도 더는 고치거나 지울 수 없습니다.
drop policy if exists "update places" on public.map_places;
create policy "update places" on public.map_places
  for update using ((created_by = auth.uid() and public.is_approved()) or public.is_admin());

drop policy if exists "delete places" on public.map_places;
create policy "delete places" on public.map_places
  for delete using ((created_by = auth.uid() and public.is_approved()) or public.is_admin());


-- ═══════════════════════════════════════════════════════════
--  4) 사진 보관함
--
--     먼저 대시보드에서  Storage → New bucket
--       이름 : map        Public bucket : 켜기(ON)
--     사진 보기는 공개로 두고, 올리는 것만 회원으로 제한합니다.
--     보관함을 만든 다음 아래를 실행하세요.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "map upload for members" on storage.objects;
create policy "map upload for members" on storage.objects
  for insert with check (bucket_id = 'map' and public.is_approved());

drop policy if exists "map manage own" on storage.objects;
create policy "map manage own" on storage.objects
  for delete using (bucket_id = 'map' and (owner = auth.uid() or public.is_admin()));


-- ═══════════════════════════════════════════════════════════
--  5) 잘 되었는지 확인 — 아래를 함께 실행하면 결과가 나옵니다
-- ═══════════════════════════════════════════════════════════

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'map_places')            as 칸_개수,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'map_places'
       and column_name = 'grp')                                             as grp칸_있음,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'map_places')               as 권한규칙_개수,
  (select count(*) from storage.buckets where id = 'map')                    as 사진보관함_있음,
  (select count(*) from public.map_places)                                   as 등록된_장소;

--  기대값 : 칸_개수 16 · grp칸_있음 1 · 권한규칙_개수 4 · 사진보관함_있음 1
--  사진보관함_있음 이 0 이면 위 4) 의 New bucket 을 아직 안 만드신 것입니다.
