-- ═══════════════════════════════════════════════════════════
--  DATA › 산업(방산) 자료를 공개로 — 가입하지 않은 분도 보고 내려받게 합니다
--
--    어디에?  skyish.kr 쪽 Supabase 프로젝트 (u-tokyo 아님)
--    어떻게?  대시보드 → SQL Editor → 아래를 통째로 붙여넣고 Run
--
--  왜 하는가
--    「HP_homepage 에서 DATA 쪽에 산업 쪽 이미지 외부에서 가입 안 한 사람들도
--      다 볼 수 있게 해 줘. 물론 데이터 다운로드도 볼 수 있게 해 주고」
--
--    방산 화면(defense-cluster.html · defense-companies.html)이 읽는
--    지도 자료·기업 명단·연구장비 그림은 모두 analysis 보관함의
--    defense 폴더에 있고, 여태는 로그인·승인된 분만 읽을 수 있었습니다.
--
--  무엇이 바뀌는가
--    ① analysis 보관함 가운데 **defense 폴더만** 누구나 읽습니다.
--       (points.json · network.json · companies.json · complexes.json ·
--        equip-map.png · companies-edits.json, 그리고 앞으로 그 폴더에 올리는 것)
--    ② 나머지 폴더(flood · travel …)는 그대로 승인된 분만 읽습니다.
--    ③ 올리기·고치기·지우기는 그대로 관리자만 합니다.
--
--  화면 쪽은 홈페이지에서 함께 바꿨습니다 —
--    pictures.html · defense-cluster.html · defense-companies.html 에서
--    로그인 확인(guard.js)을 뺐고, 방산 화면 맨 아래에 「자료 내려받기」 칸을 두었습니다.
--
--  되돌리려면 맨 아래 「되돌리기」 한 줄을 실행하세요.
-- ═══════════════════════════════════════════════════════════


-- ── 1) defense 폴더 열람 — 누구나 ────────────────────────────
--     to 를 적지 않으면 anon(로그인 안 함)·authenticated 모두에게 적용됩니다.
--     기존 「analysis read for approved」(승인된 분은 전부 읽음)는 그대로 둡니다 —
--     규칙은 하나만 맞아도 통과하므로 서로 방해하지 않습니다.
drop policy if exists "analysis defense read for everyone" on storage.objects;
create policy "analysis defense read for everyone" on storage.objects
  for select using (
    bucket_id = 'analysis'
    and name like 'defense/%'
  );


-- ── 2) 확인 ──────────────────────────────────────────────────
--     아래 줄이 1 이면 됩니다. 그다음 로그아웃한 창(시크릿 창)에서
--     https://skyish.kr/defense-cluster.html 을 열어 지도가 그려지는지 봐 주세요.
select count(*) as 공개규칙
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'analysis defense read for everyone';


-- ── 되돌리기 (필요할 때만) ────────────────────────────────────
-- drop policy if exists "analysis defense read for everyone" on storage.objects;
