-- ═══════════════════════════════════════════════════════════
--
--   개인 홈페이지 skyish.kr — 자료 쪽 설정 한 번에
--
--   실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--          (skyish76@gmail.com 계정의 프로젝트)
--
--   여러 번 실행해도 안전합니다. 이미 되어 있는 것은 그냥 지나갑니다.
--   앞의 것이 뒤의 것의 바탕이 되므로 순서를 바꾸지 마십시오.
--
--   ※ 먼저 해 두실 것 — Storage 에 보관함 두 개를 만들어 주세요.
--        files     (비공개)   붙임 파일
--        analysis  (비공개)   분석 자료
--      Storage → New bucket → 이름 적고 Public 은 꺼 둡니다.
--
--   담긴 것
--      1. setup.sql              회원 정보 (profiles) 와 기본 규칙
--      2. roles_setup.sql        관리자·일반회원 가르기  ★ 이게 빠지면 글이 0건으로 보입니다
--      3. notes_setup.sql        My WAY… 게시판 (notes)
--      4. event_setup.sql        일정 칸 — 행사명·시간·연락처
--      5. files_setup.sql        붙임 파일 (files 보관함이 먼저 있어야 합니다)
--      6. map_setup.sql          지도 장소 (map_places)
--      7. map_cats.sql           지도 분류 넓히기 — 맛집6·부동산4·도시건축6
--      8. map_fav.sql            My Favorite
--      9. gallery_setup.sql      사진첩
--     10. sites_setup.sql        CONTACT 의 Sites
--
--   여기 없는 것
--     merge_diary.sql        Diary 를 Schedule 로 합치던 것 — 지금은 갈래를
--                            다시 나눴으므로 돌리면 안 됩니다
--     admin_setup.sql        roles_setup.sql 이 대신합니다
--     owner_setup.sql        roles_setup.sql 이 대신합니다
--     u-tokyo_self_edit.sql  동문회 사이트용입니다 (다른 프로젝트)
-- ═══════════════════════════════════════════════════════════




-- ╔═══════════════════════════════════════════════════════╗
-- ║  1 / 10   setup.sql
-- ║  회원 정보 (profiles) 와 기본 규칙
-- ╚═══════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════
--  skyish.kr 회원·권한 초기 설정  (Supabase 전용 프로젝트)
--
--  실행: Supabase 대시보드 → SQL Editor → New query
--        아래 전체를 붙여넣고 Run
--
--  여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════

-- ── 1) 회원 프로필 ────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  name            text,
  affiliation     text,                                   -- 소속 (승인 판단용)
  analysis_access boolean not null default false,         -- 열람 승인 여부
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ── 2) 행 단위 보안 : 본인 것만 보고, 권한은 스스로 못 바꿈 ──
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and analysis_access = (select analysis_access from public.profiles where id = auth.uid())
    and is_admin        = (select is_admin        from public.profiles where id = auth.uid())
  );

-- ── 3) 가입하면 프로필 자동 생성 ──────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, affiliation)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'affiliation', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 이 SQL 실행 전에 만든 계정이 있으면 프로필을 채워 넣습니다
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);


-- ═══════════════════════════════════════════════════════════
--  4) 분석 자료 보관함 (비공개 버킷)
--
--     먼저 대시보드에서  Storage → New bucket
--       이름: analysis        Public bucket: 반드시 꺼짐(OFF)
--     그다음 아래를 실행하세요.
-- ═══════════════════════════════════════════════════════════

drop policy if exists "analysis read for approved" on storage.objects;
create policy "analysis read for approved" on storage.objects
  for select using (
    bucket_id = 'analysis'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.analysis_access
    )
  );

drop policy if exists "analysis write for admin" on storage.objects;
create policy "analysis write for admin" on storage.objects
  for all using (
    bucket_id = 'analysis'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );


-- ═══════════════════════════════════════════════════════════
--  5) 관리자가 쓰는 명령
-- ═══════════════════════════════════════════════════════════

-- ▸ 나에게 관리자·열람 권한 주기 (이메일을 본인 것으로)
-- update public.profiles
--    set analysis_access = true, is_admin = true
--  where email = 'skyish76@gmail.com';

-- ▸ 승인 대기자 보기
-- select email, name, affiliation, created_at
--   from public.profiles
--  where analysis_access = false
--  order by created_at desc;

-- ▸ 특정 회원 승인
-- update public.profiles set analysis_access = true where email = 'someone@example.com';

-- ▸ 승인 취소
-- update public.profiles set analysis_access = false where email = 'someone@example.com';


-- ╔═══════════════════════════════════════════════════════╗
-- ║  2 / 10   roles_setup.sql
-- ║  관리자·일반회원 가르기  ★ 이게 빠지면 글이 0건으로 보입니다
-- ╚═══════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════
--  등급 정리 — 관리자 · 일반회원
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  여러 번 실행해도 안전합니다.
--
--  ▸ 관리자   whlove@gmail.com · skyish76@gmail.com
--             모든 것을 봅니다. 가입자 목록을 보고 승인합니다.
--  ▸ 일반회원 승인을 받은 분
--             TRAVEL · DATA 를 봅니다.
--             BLOG 는 「일상」만 봅니다. 글을 쓰거나 고칠 수는 없습니다.
--  ▸ 그 밖    공개된 화면만 봅니다.
--
--  ※ 주인 이메일은 profiles 에 줄이 없어도 관리자로 봅니다.
--     그래서 이 파일만 돌리면 바로 관리자로 들어가집니다.
-- ═══════════════════════════════════════════════════════════


-- ── 1) 관리자 판정 — 이메일로도 알아봅니다 ──
--     지금까지는 profiles.is_admin 만 봤습니다. 그 줄이 없으면 관리자여도
--     관리자가 아니게 되어, 아무것도 못 하는 상태에 갇혔습니다.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$
  select coalesce((
    select coalesce(p.is_admin, false)
        or lower(u.email) in ('whlove@gmail.com', 'skyish76@gmail.com')
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = auth.uid()
  ), false)
$$;

-- ── 2) 승인 판정 — 관리자는 늘 승인된 것으로 봅니다 ──
create or replace function public.is_approved()
returns boolean language sql security definer stable set search_path = public
as $$
  select coalesce((
    select coalesce(p.analysis_access, false)
        or coalesce(p.is_admin, false)
        or lower(u.email) in ('whlove@gmail.com', 'skyish76@gmail.com')
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = auth.uid()
  ), false)
$$;


-- ── 3) 주인 계정의 프로필을 채워 둡니다 ──
insert into public.profiles (id, email, name, affiliation, analysis_access, is_admin)
select u.id, u.email,
       coalesce(nullif(u.raw_user_meta_data->>'name', ''), '남지현'),
       coalesce(nullif(u.raw_user_meta_data->>'affiliation', ''), '경기연구원'),
       true, true
  from auth.users u
 where lower(u.email) in ('whlove@gmail.com', 'skyish76@gmail.com')
    on conflict (id) do update
   set analysis_access = true, is_admin = true;

update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where lower(email) in ('whlove@gmail.com', 'skyish76@gmail.com');


-- ── 3.5) 갈래 넓히기 (일상 · ETC 추가) ──
alter table public.notes drop constraint if exists notes_cat_check;
alter table public.notes add  constraint notes_cat_check
  check (category in ('schedule','diary','contacts','people','minutes','daily','etc'));


-- ── 4) 기록장(BLOG) — 관리자는 전부, 일반회원은 일상만 ──
alter table public.notes enable row level security;

drop policy if exists "admin reads notes"   on public.notes;
drop policy if exists "admin writes notes"  on public.notes;
drop policy if exists "admin updates notes" on public.notes;
drop policy if exists "admin deletes notes" on public.notes;
drop policy if exists "read notes"          on public.notes;

--   보기 : 관리자는 모두 · 승인된 회원은 일상(diary)만
create policy "read notes" on public.notes
  for select using (
    public.is_admin()
    or (public.is_approved() and category = 'daily')
  );

--   쓰기·고치기·지우기 : 관리자만
create policy "admin writes notes"  on public.notes
  for insert with check (public.is_admin() and created_by = auth.uid());
create policy "admin updates notes" on public.notes
  for update using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes notes" on public.notes
  for delete using (public.is_admin());


-- ── 5) 회원 목록 — 관리자만 보고 고칩니다 ──
drop policy if exists "admin reads all profiles" on public.profiles;
create policy "admin reads all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "admin updates profiles" on public.profiles;
create policy "admin updates profiles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());


-- ── 6) 가입하면 주인은 저절로 관리자 ──
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  owner boolean := lower(new.email) in ('whlove@gmail.com', 'skyish76@gmail.com');
begin
  insert into public.profiles (id, email, name, affiliation, analysis_access, is_admin)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', ''),
          coalesce(new.raw_user_meta_data->>'affiliation', ''),
          owner, owner)
     on conflict (id) do update
    set analysis_access = public.profiles.analysis_access or owner,
        is_admin        = public.profiles.is_admin        or owner;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ═══════════════════════════════════════════════════════════
--  확인 — 주인 계정이 승인·관리자 로 나와야 합니다
-- ═══════════════════════════════════════════════════════════

select u.email                            as 이메일,
       p.name                             as 이름,
       (p.id is not null)                 as 프로필있음,
       coalesce(p.analysis_access, false)  as 승인,
       coalesce(p.is_admin, false)         as 관리자
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by u.created_at;


-- ╔═══════════════════════════════════════════════════════╗
-- ║  3 / 10   notes_setup.sql
-- ║  My WAY… 게시판 (notes)
-- ╚═══════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════╗
-- ║  4 / 10   event_setup.sql
-- ║  일정 칸 — 행사명·시간·연락처
-- ╚═══════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════
--  일정 칸 넣기 — 행사명 · 시간 · 연락처 (My WAY…)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/notes_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  게시판 한 건이 담는 것
--    Date     event_date   날짜      (이미 있음)
--    Time     event_time   시간      ← 이번에 만듭니다
--    Place    place        장소      (이미 있음)
--    Type     tag          유형·말머리 (이미 있음 — 발표·토론·자문회의…)
--    Contact  contact      연락처    ← 이번에 만듭니다
--    People   people       만난 사람 (이미 있음)
--    Event    event        행사명    ← 이번에 만듭니다
--
--  폴더 이름 「20260828_[토론] (박진우) 자치행정학회」 를 읽으면
--    날짜 2026-08-28 · 유형 토론 · 연락처 박진우 · 행사명 자치행정학회
--  가 저절로 채워집니다.
-- ═══════════════════════════════════════════════════════════


alter table public.notes add column if not exists event      text;
alter table public.notes add column if not exists event_time text;
alter table public.notes add column if not exists contact    text;

comment on column public.notes.event      is '행사명 (붙임 파일에서 저절로 찾습니다)';
comment on column public.notes.event_time is '시간 — 14:00 또는 14:00~16:00 처럼 글자로 둡니다';
comment on column public.notes.contact    is '연락처 — 폴더 이름의 (   ) 안에 적은 사람·기관';

-- 찾기가 자주 걸리는 칸에 색인을 둡니다
create index if not exists notes_event_idx   on public.notes (event);
create index if not exists notes_contact_idx on public.notes (contact);


-- ═══════════════════════════════════════════════════════════
--  확인 — 3 이 나와야 합니다
-- ═══════════════════════════════════════════════════════════

select count(*) as 새로_생긴_칸
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'notes'
   and column_name in ('event', 'event_time', 'contact');


-- ╔═══════════════════════════════════════════════════════╗
-- ║  5 / 10   files_setup.sql
-- ║  붙임 파일 (files 보관함이 먼저 있어야 합니다)
-- ╚═══════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════╗
-- ║  6 / 10   map_setup.sql
-- ║  지도 장소 (map_places)
-- ╚═══════════════════════════════════════════════════════╝

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
  check (grp in ('hot','urban','estate','trip','food','daily','etc'));

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


-- ╔═══════════════════════════════════════════════════════╗
-- ║  7 / 10   map_cats.sql
-- ║  지도 분류 넓히기 — 맛집6·부동산4·도시건축6
-- ╚═══════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════
--  지도 분류 넓히기 — 맛집 아래로 한식·일식·중식·기타
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/map_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  분류
--    맛집 food    ← 갈래를 아직 안 나눈 옛 장소가 여기 남습니다
--      한식 kfood
--      일식 jfood
--      중식 cfood
--      기타 efood   (양식·아시아·분식처럼 위에 없는 것)
--      카페 cafe
--    APT apt
--      My Home myhome · Remodeling remodel · Interior intr
--    건축물 arch
--      유명건축 farch · 도시개발 udev · 도시재생 urgn ·
--      역세권개발 tod · 역사건축 harch
--    핫플 hot
-- ═══════════════════════════════════════════════════════════

alter table public.map_places drop constraint if exists map_places_category_check;
alter table public.map_places add  constraint map_places_category_check
  check (category in (
    'food','kfood','jfood','cfood','efood','cafe','dessert','tea','ucafe',
    'apt','myhome','remodel','intr',
    'arch','farch','udev','urgn','tod','harch',
    'hot','hkor','hwest','hasia','hchn','hjpn','hcafe','hbar','hshop'));

comment on column public.map_places.category is
  '분류 : 맛집 food/kfood/jfood/cfood/efood/cafe · 부동산 apt/myhome/remodel/intr · 도시건축 arch/farch/udev/urgn/tod/harch · hot';


-- ═══════════════════════════════════════════════════════════
--  확인 — 지금 담긴 분류와 개수
-- ═══════════════════════════════════════════════════════════

select category as 분류, count(*) as 곳
  from public.map_places
 group by category
 order by count(*) desc;


-- ╔═══════════════════════════════════════════════════════╗
-- ║  8 / 10   map_fav.sql
-- ║  My Favorite
-- ╚═══════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════
--  My Favorite 칸 넣기 (지도)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/map_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  장소 하나하나에 별을 달아 두고,
--  MAP 의 「종합」 갈래에서 「My Favorite 만」 으로 골라 볼 수 있습니다.
-- ═══════════════════════════════════════════════════════════

alter table public.map_places add column if not exists fav boolean not null default false;

comment on column public.map_places.fav is 'My Favorite — 종합 갈래에서 골라 보기';

-- 골라 볼 때 빠르도록
create index if not exists map_places_fav_idx on public.map_places (fav) where fav;


-- ═══════════════════════════════════════════════════════════
--  확인 — 1 이 나와야 합니다
-- ═══════════════════════════════════════════════════════════

select count(*) as My_Favorite_칸
  from information_schema.columns
 where table_schema='public' and table_name='map_places' and column_name='fav';


-- ╔═══════════════════════════════════════════════════════╗
-- ║  9 / 10   gallery_setup.sql
-- ║  사진첩
-- ╚═══════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════╗
-- ║  10 / 10   sites_setup.sql
-- ║  CONTACT 의 Sites
-- ╚═══════════════════════════════════════════════════════╝

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


-- ╔═══════════════════════════════════════════════════════╗
-- ║  마지막 — 다 되었는지 한눈에
-- ╚═══════════════════════════════════════════════════════╝

select
  (select count(*) from information_schema.tables
     where table_schema='public'
       and table_name in ('profiles','notes','map_places',
                          'gallery_albums','gallery_photos','sites'))   as 표_6개,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='notes'
       and column_name in ('event','event_time','contact','files','extract')) as 일정칸_5개,
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='map_places'
       and column_name='fav')                                          as 즐겨찾기칸_1개,
  (select count(*) from storage.buckets where id in ('files','analysis')) as 보관함_2개,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname in ('is_admin','is_approved'))  as 판정함수_2개;

--  기대값 : 표 6 · 일정칸 5 · 즐겨찾기칸 1 · 보관함 2 · 판정함수 2
--  보관함이 2 가 아니면 Storage 에서 files · analysis 를 만들어 주세요.


--  내 계정이 관리자로 잡혔는지
select u.email                              as 이메일,
       (p.id is not null)                   as 프로필있음,
       coalesce(p.analysis_access, false)   as 승인,
       coalesce(p.is_admin, false)          as 관리자
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by u.created_at;
