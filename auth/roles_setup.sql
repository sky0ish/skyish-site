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
