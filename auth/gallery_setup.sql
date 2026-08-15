-- ═══════════════════════════════════════════════════════════
--  GALLERY — 사진첩
--
--  갈래 : urban(Urban) · arch(Architecture) · architects(Architects)
--         house(House) · daily(Daily Life) · etc(ETC)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql 을 실행해 두셔야 합니다 (profiles 표가 필요합니다)
--  여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════


-- ── 0) 승인 여부 확인 함수 (map_setup.sql 과 같은 것입니다) ──
create or replace function public.is_approved()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select analysis_access or is_admin
                         from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin
                         from public.profiles where id = auth.uid()), false) $$;


-- ── 1) 사진첩 ────────────────────────────────────────────────

create table if not exists public.gallery_albums (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'etc',
  title       text not null,
  event_date  date,                        -- 언제 찍은 것인지 (목록 정렬 기준)
  cover_url   text,                        -- 대표 사진 (없으면 첫 사진)
  address     text,                        -- 주소 (제목으로 찾아 자동으로 채웁니다)
  lat         double precision,
  lng         double precision,
  feature     text,                        -- 건축특징
  note        text,
  owner_name  text,
  owner_admin boolean not null default false,
  created_by  uuid,
  created_at  timestamptz not null default now()
);

-- 표를 이미 만들어 두셨던 분을 위해 — 없으면 더하고, 있으면 그대로 둡니다
alter table public.gallery_albums add column if not exists address text;
alter table public.gallery_albums add column if not exists lat     double precision;
alter table public.gallery_albums add column if not exists lng     double precision;
alter table public.gallery_albums add column if not exists feature text;

-- ── 2) 사진 ──────────────────────────────────────────────────

create table if not exists public.gallery_photos (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid references public.gallery_albums(id) on delete cascade,
  caption      text,
  image_url    text not null,
  storage_path text,
  taken_at     date,
  sort         int not null default 0,
  owner_name   text,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

create index if not exists gallery_albums_cat_idx
  on public.gallery_albums (category, event_date desc, created_at desc);
create index if not exists gallery_photos_album_idx
  on public.gallery_photos (album_id, sort, created_at);

-- ── 3) 갈래 규칙 (갈래를 바꾸면 다시 실행하세요) ──
alter table public.gallery_albums drop constraint if exists gallery_albums_cat_check;
alter table public.gallery_albums add  constraint gallery_albums_cat_check
  check (category in ('urban','arch','architects','house','daily','etc'));


-- ── 4) 열람·등록 권한 ─────────────────────────────────────────
--     보기      : 누구나
--     만들기    : 승인된 회원이, 본인 명의로만
--     고치기·지우기 : 승인 상태인 본인, 또는 관리자

alter table public.gallery_albums enable row level security;
alter table public.gallery_photos enable row level security;

drop policy if exists "read albums" on public.gallery_albums;
create policy "read albums" on public.gallery_albums for select using (true);

drop policy if exists "insert albums" on public.gallery_albums;
create policy "insert albums" on public.gallery_albums
  for insert with check (
    public.is_approved()
    and created_by  = auth.uid()
    and owner_admin = public.is_admin()
  );

drop policy if exists "update albums" on public.gallery_albums;
create policy "update albums" on public.gallery_albums
  for update using ((created_by = auth.uid() and public.is_approved()) or public.is_admin());

drop policy if exists "delete albums" on public.gallery_albums;
create policy "delete albums" on public.gallery_albums
  for delete using ((created_by = auth.uid() and public.is_approved()) or public.is_admin());

drop policy if exists "read photos" on public.gallery_photos;
create policy "read photos" on public.gallery_photos for select using (true);

drop policy if exists "insert photos" on public.gallery_photos;
create policy "insert photos" on public.gallery_photos
  for insert with check (public.is_approved() and created_by = auth.uid());

drop policy if exists "update photos" on public.gallery_photos;
create policy "update photos" on public.gallery_photos
  for update using ((created_by = auth.uid() and public.is_approved()) or public.is_admin());

drop policy if exists "delete photos" on public.gallery_photos;
create policy "delete photos" on public.gallery_photos
  for delete using ((created_by = auth.uid() and public.is_approved()) or public.is_admin());


-- ═══════════════════════════════════════════════════════════
--  5) 사진 보관함
--
--     먼저 대시보드에서  Storage → New bucket
--       이름 : gallery      Public bucket : 켜기(ON)
--     그다음 아래를 실행하세요.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "gallery upload for members" on storage.objects;
create policy "gallery upload for members" on storage.objects
  for insert with check (bucket_id = 'gallery' and public.is_approved());

drop policy if exists "gallery manage own" on storage.objects;
create policy "gallery manage own" on storage.objects
  for delete using (bucket_id = 'gallery' and (owner = auth.uid() or public.is_admin()));


-- ═══════════════════════════════════════════════════════════
--  6) 잘 되었는지 확인
-- ═══════════════════════════════════════════════════════════

select
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='gallery_albums')  as 사진첩표,
  (select count(*) from information_schema.tables
     where table_schema='public' and table_name='gallery_photos')  as 사진표,
  (select count(*) from pg_policies
     where schemaname='public' and tablename in ('gallery_albums','gallery_photos')) as 권한규칙,
  (select count(*) from storage.buckets where id='gallery')        as 보관함,
  (select count(*) from public.gallery_albums)                     as 등록된_사진첩;

--  기대값 : 사진첩표 1 · 사진표 1 · 권한규칙 8 · 보관함 1
