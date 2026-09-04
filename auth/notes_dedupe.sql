-- ─────────────────────────────────────────────────────────────
--  두 줄로 들어간 글을 하나로 — skyish.kr (qmdovjlxfvinknuizelw)
--  Supabase → SQL Editor 에 붙여넣고, ① 을 먼저 돌려 눈으로 보신 뒤
--  ② 를 돌리세요.
--
--  까닭 : 글쓰기 창 위쪽 「저장」 단추가 저장을 두 번 불렀습니다.
--         (아래 단추의 손을 직접 부르고, 그다음 진짜 클릭도 보냈습니다.)
--         2026-09-05 에 고쳤습니다. 그 전에 쓴 글이 두 줄로 남아 있습니다.
--
--  겹쳤다고 보는 기준 — 이 다섯이 모두 같을 때만입니다.
--    쓴 사람 · 갈래 · 날짜 · 제목 · 본문
--  하나라도 다르면 건드리지 않습니다. 같은 날 같은 제목이라도
--  본문이 다르면 따로 쓰신 글로 봅니다.
--
--  남기는 쪽 : 구글 일정 번호(gcal_id)가 있는 것을 먼저,
--              없으면 먼저 쓰인 것(created_at 이 이른 쪽).
--              그래야 달력의 구글 짝짓기가 끊기지 않습니다.
-- ─────────────────────────────────────────────────────────────

-- ① 무엇이 겹쳤는지 봅니다 (아무것도 지우지 않습니다)
with d as (
  select
    id, title, category, event_date, created_at, gcal_id,
    row_number() over (
      partition by created_by, category,
                   coalesce(event_date::text, ''),
                   btrim(coalesce(title, '')),
                   btrim(coalesce(body, ''))
      order by (gcal_id is not null) desc, created_at asc
    ) as rn,
    count(*) over (
      partition by created_by, category,
                   coalesce(event_date::text, ''),
                   btrim(coalesce(title, '')),
                   btrim(coalesce(body, ''))
    ) as n
  from public.notes
)
select
  case when rn = 1 then '남김' else '지울 것' end as 어떻게,
  event_date as 날짜, category as 갈래, title as 제목,
  n as 몇줄, gcal_id as 구글번호, created_at as 쓴시각, id
from d
where n > 1
order by btrim(coalesce(title, '')), event_date, rn;

-- ② 몇 건이나 지워질지 먼저 셉니다
with d as (
  select id,
    row_number() over (
      partition by created_by, category,
                   coalesce(event_date::text, ''),
                   btrim(coalesce(title, '')),
                   btrim(coalesce(body, ''))
      order by (gcal_id is not null) desc, created_at asc
    ) as rn
  from public.notes
)
select count(*) as 지울줄수 from d where rn > 1;

-- ③ 겹친 것을 지웁니다 — ① 과 ② 를 보신 뒤에 돌리세요
-- (붙임 파일은 보관함에 그대로 남습니다. 같은 파일을 두 글이 가리키고
--  있었으므로, 남는 글이 계속 씁니다.)
with d as (
  select id,
    row_number() over (
      partition by created_by, category,
                   coalesce(event_date::text, ''),
                   btrim(coalesce(title, '')),
                   btrim(coalesce(body, ''))
      order by (gcal_id is not null) desc, created_at asc
    ) as rn
  from public.notes
)
delete from public.notes
where id in (select id from d where rn > 1);

-- ④ 남았는지 확인 — 0 이 나와야 합니다
with d as (
  select id,
    count(*) over (
      partition by created_by, category,
                   coalesce(event_date::text, ''),
                   btrim(coalesce(title, '')),
                   btrim(coalesce(body, ''))
    ) as n
  from public.notes
)
select count(*) as 아직겹친줄 from d where n > 1;
