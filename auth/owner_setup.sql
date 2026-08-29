-- ═══════════════════════════════════════════════════════════
--  주인 계정을 승인 없이 바로 관리자로
--
--    whlove@gmail.com   ·   skyish76@gmail.com
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  여러 번 실행해도 안전합니다.
--
--  이 파일이 하는 일 세 가지
--    ① 프로필이 없으면 만들어 줍니다 (가입은 했는데 줄이 안 생긴 경우)
--    ② 두 계정에 승인·관리자 권한을 줍니다
--    ③ 앞으로 이 두 이메일로 가입하면 저절로 관리자가 되게 합니다
-- ═══════════════════════════════════════════════════════════


-- ── ① + ② 지금 있는 계정을 관리자로 ──
--     프로필이 없으면 만들고, 있으면 권한만 켭니다.

insert into public.profiles (id, email, name, affiliation, analysis_access, is_admin)
select u.id,
       u.email,
       coalesce(nullif(u.raw_user_meta_data->>'name', ''), '남지현'),
       coalesce(nullif(u.raw_user_meta_data->>'affiliation', ''), '경기연구원'),
       true, true
  from auth.users u
 where lower(u.email) in ('whlove@gmail.com', 'skyish76@gmail.com')
    on conflict (id) do update
   set analysis_access = true,
       is_admin        = true;

-- 메일 확인이 안 끝난 상태라면 함께 풀어 줍니다
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where lower(email) in ('whlove@gmail.com', 'skyish76@gmail.com');


-- ── ③ 앞으로 가입해도 저절로 관리자 ──
--     주인 이메일이면 승인 절차 없이 바로 열립니다.
--     다른 분들은 지금까지처럼 승인을 기다립니다.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  owner boolean := lower(new.email) in ('whlove@gmail.com', 'skyish76@gmail.com');
begin
  insert into public.profiles (id, email, name, affiliation, analysis_access, is_admin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'affiliation', ''),
    owner,          -- 주인이면 바로 승인
    owner           -- 주인이면 바로 관리자
  )
  on conflict (id) do update
    set analysis_access = public.profiles.analysis_access or owner,
        is_admin        = public.profiles.is_admin        or owner;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ═══════════════════════════════════════════════════════════
--  확인 — 아래 결과가 이렇게 나와야 합니다
--     analysis_access = true,  is_admin = true
-- ═══════════════════════════════════════════════════════════

select u.email                                as 이메일,
       p.name                                 as 이름,
       (u.email_confirmed_at is not null)     as 메일확인,
       (p.id is not null)                     as 프로필있음,
       p.analysis_access                      as 승인됨,
       p.is_admin                             as 관리자
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by u.created_at;
