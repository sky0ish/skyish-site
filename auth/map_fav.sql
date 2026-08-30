-- ═══════════════════════════════════════════════════════════
--  My Favorite 칸 넣기 (지도)
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/map_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  장소 하나하나에 별을 달아 두고,
--  MAP 의 「종합」 갈래에서 「My Favorite 만」 으로 골라 볼 수 있습니다.
-- ═══════════════════════════════════════════════════════════

alter table public.map_places add column if not exists fav boolean not null default false;

comment on column public.map_places.fav is 'My Favorite — 종합 갈래에서 골라 보기';

-- 골라 볼 때 빠르도록
create index if not exists map_places_fav_idx on public.map_places (fav) where fav;


-- ═══════════════════════════════════════════════════════════
--  확인 — 1 이 나와야 합니다
-- ═══════════════════════════════════════════════════════════

select count(*) as My_Favorite_칸
  from information_schema.columns
 where table_schema='public' and table_name='map_places' and column_name='fav';
