-- ═══════════════════════════════════════════════════════════
--  notes 에 「구글 일정 번호」 칸을 하나 더합니다
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/setup.sql · auth/notes_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  ■ 왜 필요한가
--  게시판에서 일정을 쓰면서 「구글 캘린더에도 넣기」 를 켜면
--  같은 일이 구글에도 들어갑니다. 그러면 달력에 두 번 그려집니다 —
--  내 글로 한 번, 구글에서 받아 온 것으로 또 한 번.
--
--  구글이 일정을 받으면 그 일정의 번호를 돌려줍니다.
--  그 번호를 글에 적어 두면, 달력에서 둘이 같은 일임을 확실히 알아
--  한 번만 그릴 수 있습니다. 이름을 고치든 시각을 옮기든 따라갑니다.
--
--  이 칸이 없어도 홈페이지는 그대로 돌아갑니다 —
--  다만 앞으로 쓰는 일정의 겹침을 못 걷습니다.
--  (이미 있는 옛 글은 「같은 날 + 같은 제목」 으로 걷습니다.)
-- ═══════════════════════════════════════════════════════════


alter table public.notes
  add column if not exists gcal_id text;

comment on column public.notes.gcal_id is
  '구글 캘린더가 매긴 일정 번호 — 달력에서 겹쳐 그리지 않으려고 적어 둡니다';

-- 달력을 그릴 때마다 번호로 짝을 짓습니다
create index if not exists notes_gcal_idx
  on public.notes (gcal_id)
  where gcal_id is not null;


-- ═══════════════════════════════════════════════════════════
--  확인 — 칸 1 이 나와야 합니다
-- ═══════════════════════════════════════════════════════════

select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'notes'
       and column_name = 'gcal_id')                    as 칸,
  (select count(*) from public.notes
     where gcal_id is not null)                        as 번호_적힌_글;
