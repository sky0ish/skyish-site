-- ═══════════════════════════════════════════════════════════
--  행사명 칸 넣기 (My WAY…)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/notes_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  붙임 파일(PDF·엑셀)에서 찾아낸 행사 이름을 담아 둡니다.
--    예) 2026년 한국지방자치학회 하계학술대회
--  엑셀로 내려받을 때 「행사명」 칸으로 함께 나갑니다.
-- ═══════════════════════════════════════════════════════════


alter table public.notes add column if not exists event text;

comment on column public.notes.event is '행사 이름 (붙임 파일에서 저절로 찾습니다)';

-- 행사명으로도 찾을 수 있게 해 둡니다
create index if not exists notes_event_idx on public.notes (event);


-- ═══════════════════════════════════════════════════════════
--  확인 — 1 이 나와야 합니다
-- ═══════════════════════════════════════════════════════════

select count(*) as 행사명_칸
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'notes'
   and column_name  = 'event';
