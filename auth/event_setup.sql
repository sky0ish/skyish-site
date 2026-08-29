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
