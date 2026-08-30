-- ═══════════════════════════════════════════════════════════
--  동경대 총동문회 사이트용 —
--  「본인 정보는 본인이 고치되, 권한은 스스로 못 바꾼다」
--
--  ※ 이 파일은 개인 홈페이지가 아니라 동문회 쪽에서 돌립니다.
--     Supabase → whlove@gmail.com 계정 → 동문회 프로젝트
--     (ojnukcciozchnsycxtfq) → SQL Editor
--
--  왜 필요한가
--    마이페이지 화면은 이미 승인 상태를 저장 대상에서 빼 두었습니다.
--    하지만 화면은 브라우저 안에 있어서, 개발자도구를 열고
--      sb.from("profiles").update({ is_admin: true }).eq("id", 내아이디)
--    를 직접 보내면 그만입니다.
--    막는 곳은 화면이 아니라 서버 쪽 규칙(RLS)이어야 합니다.
--
--  여러 번 실행해도 안전합니다.
-- ═══════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────
--  ① 먼저 지금 걸려 있는 규칙을 봅니다
--     이 결과를 저에게 보여 주시면 ②에서 지울 이름을 정확히 맞춰 드립니다.
-- ───────────────────────────────────────────────────────────

select policyname  as 규칙이름,
       cmd         as 무엇을,
       qual        as "볼 수 있는 조건",
       with_check  as "쓸 수 있는 조건"
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
 order by cmd, policyname;

--  ※ 중요 : 규칙이 여러 개면 「하나라도 통과하면 통과」입니다.
--     느슨한 update 규칙이 하나라도 남아 있으면 아래 규칙을 넣어도 소용없습니다.
--     그래서 ② 에서 옛 규칙을 먼저 지웁니다.


-- ───────────────────────────────────────────────────────────
--  ② 본인 수정 규칙을 다시 깝니다
-- ───────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

-- 흔히 쓰이는 이름들을 미리 지웁니다.
-- ① 결과에 여기 없는 이름이 있으면 알려 주세요. 그것도 함께 지워야 합니다.
drop policy if exists "update own profile"        on public.profiles;
drop policy if exists "본인 정보 수정"             on public.profiles;
drop policy if exists "users update own profile"  on public.profiles;
drop policy if exists "profiles update own"       on public.profiles;
drop policy if exists "self update"               on public.profiles;
drop policy if exists "self edits own profile"    on public.profiles;

--  본인 것만 봅니다
drop policy if exists "self reads own profile" on public.profiles;
create policy "self reads own profile" on public.profiles
  for select using (auth.uid() = id);

--  본인 것만 고칩니다 — 다만 권한 칸 세 개는 그대로여야 통과합니다.
--
--  is not distinct from 을 쓰는 까닭 :
--    그냥 = 로 견주면 값이 비어 있을(null) 때 결과가 「모름」이 되어
--    조건이 통과하지 못합니다. 그러면 본인이 자기 정보를 못 고칩니다.
--    is not distinct from 은 비어 있는 값끼리도 같다고 봅니다.
drop policy if exists "self edits own profile" on public.profiles;
create policy "self edits own profile" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and approved is not distinct from (select approved from public.profiles where id = auth.uid())
    and is_admin is not distinct from (select is_admin from public.profiles where id = auth.uid())
    and grade    is not distinct from (select grade    from public.profiles where id = auth.uid())
  );

--  스스로 지우지는 못하게 둡니다 (탈퇴는 운영자를 거칩니다).
--  회원이 직접 탈퇴하게 하시려면 이 줄의 주석을 푸십시오.
-- drop policy if exists "self deletes own profile" on public.profiles;
-- create policy "self deletes own profile" on public.profiles
--   for delete using (auth.uid() = id);


-- ───────────────────────────────────────────────────────────
--  ③ 확인 — 정말 막혔는지 스스로 시험해 봅니다
--
--  아래는 「내가 나를 관리자로 올리기」를 시늉 내 봅니다.
--  제대로 막혀 있으면 0 줄이 고쳐집니다.
--  (관리자 계정으로 돌리면 관리자 규칙 때문에 통과할 수 있으니,
--   일반 회원 계정으로 로그인한 브라우저에서 시험하시는 편이 확실합니다.)
-- ───────────────────────────────────────────────────────────

select policyname as 규칙이름, cmd as 무엇을
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles'
 order by cmd, policyname;

--  기대하는 모습
--    select : self reads own profile  (+ 관리자용 규칙)
--    update : self edits own profile  (+ 관리자용 규칙)
--    update 쪽에 이 둘 말고 다른 이름이 또 있으면,
--    그것이 느슨한 문일 수 있으니 저에게 알려 주세요.
