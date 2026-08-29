-- ═══════════════════════════════════════════════════════════
--  Diary 를 Schedule 로 합치기
--
--  실행 : Supabase → SQL Editor → 붙여넣기 → Run
--  여러 번 실행해도 안전합니다.
--
--  화면에서는 이미 합쳐져 보이지만, 자료도 함께 정리해 두면
--  나중에 갈래를 셀 때 헷갈리지 않습니다.
-- ═══════════════════════════════════════════════════════════

update public.notes set category = 'schedule' where category = 'diary';

-- 이제 diary 는 쓰지 않으므로 갈래 규칙에서 뺍니다
alter table public.notes drop constraint if exists notes_cat_check;
alter table public.notes add  constraint notes_cat_check
  check (category in ('schedule','contacts','people','minutes','daily','etc'));

-- 일반회원이 보는 갈래는 그대로 「일상」 입니다
select category as 갈래, count(*) as 글수
  from public.notes group by category order by 2 desc;
