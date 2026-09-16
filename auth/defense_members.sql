-- ═══════════════════════════════════════════════════════════
--  DATA 갈래 전체를 회원만 — 방산(defense) 자료의 「누구나 읽기」 규칙을 지웁니다
--
--    어디에?  skyish.kr 쪽 Supabase 프로젝트 (qmdovjlxfvinknuizelw — u-tokyo 아님)
--    어떻게?  대시보드 → SQL Editor → 아래를 통째로 붙여넣고 Run
--
--  왜 하는가
--    「이제 데이타 폴더의 전체를 가입한 사람만 볼수있게 바꿔줘」 (2026-09-17)
--
--    2026-09-14 에 auth/defense_public.sql 로 analysis 보관함의 defense 폴더를
--    누구나 읽게 열었습니다 (로그인 없이 방산 화면을 보고 내려받게).
--    이제 DATA 갈래(방산 · 기업 리스트 · 노후산단 · 침수) 전체를 로그인·승인된
--    회원만 보게 하므로, 그 공개 규칙을 지워 보관함도 다시 회원만 읽게 합니다.
--
--  무엇이 바뀌는가
--    ① 「analysis defense read for everyone」 규칙 삭제 —
--       defense 폴더도 다른 폴더(flood · travel …)와 같이 승인된 분만 읽습니다
--       (기존 「analysis read for approved」 규칙이 그대로 맡습니다).
--    ② 올리기·고치기·지우기는 그대로 관리자만.
--
--  화면 쪽은 홈페이지에서 함께 바꿨습니다 —
--    pictures.html · defense-cluster.html · defense-companies.html · aging-complex.html 에
--    로그인 확인(guard.js)을 다시 걸었습니다 (flood-basement.html 은 원래 걸려 있음).
--
--  주의: 이 SQL 을 실행하기 전까지는 로그인 없이도 주소만 알면 defense 폴더의
--        파일을 받을 수 있습니다 (화면은 이미 막혔지만 보관함은 열려 있는 상태).
-- ═══════════════════════════════════════════════════════════


-- ── 1) defense 폴더 공개 규칙 삭제 ─────────────────────────────
drop policy if exists "analysis defense read for everyone" on storage.objects;


-- ── 2) 확인 ──────────────────────────────────────────────────
--     아래가 0 이면 됩니다 (공개 규칙 없음). 승인된 분의 읽기 규칙은 남아 있어야 합니다 — 둘째 줄이 1.
select count(*) as 공개규칙
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'analysis defense read for everyone';

select count(*) as 승인회원_읽기규칙
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'analysis read for approved';

--     그다음 로그아웃한 창(시크릿 창)에서 https://skyish.kr/defense-cluster.html 을 열면
--     로그인 화면으로 넘어가야 하고, 아래 주소는 400 이어야 합니다 (apikey 만 붙여 curl):
--       https://qmdovjlxfvinknuizelw.supabase.co/storage/v1/object/authenticated/analysis/defense/points.json
