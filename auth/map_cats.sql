-- ═══════════════════════════════════════════════════════════
--  지도 분류 넓히기 — 맛집 아래로 한식·일식·중식·기타
--
--  실행 : Supabase → SQL Editor → 전체 붙여넣기 → Run
--  먼저 : auth/map_setup.sql
--  여러 번 실행해도 안전합니다.
--
--  분류
--    맛집 food    ← 갈래를 아직 안 나눈 옛 장소가 여기 남습니다
--      한식 kfood
--      일식 jfood
--      중식 cfood
--      기타 efood   (양식·아시아·분식처럼 위에 없는 것)
--      카페 cafe
--    APT apt
--      My Home myhome · Remodeling remodel · Interior intr
--    건축물 arch
--      유명건축 farch · 도시개발 udev · 도시재생 urgn ·
--      역세권개발 tod · 역사건축 harch
--    핫플 hot
-- ═══════════════════════════════════════════════════════════

alter table public.map_places drop constraint if exists map_places_category_check;
alter table public.map_places add  constraint map_places_category_check
  check (category in (
    'food','kfood','jfood','cfood','efood','cafe',
    'apt','myhome','remodel','intr',
    'arch','farch','udev','urgn','tod','harch',
    'hot'));

comment on column public.map_places.category is
  '분류 : 맛집 food/kfood/jfood/cfood/efood/cafe · 부동산 apt/myhome/remodel/intr · 도시건축 arch/farch/udev/urgn/tod/harch · hot';


-- ═══════════════════════════════════════════════════════════
--  확인 — 지금 담긴 분류와 개수
-- ═══════════════════════════════════════════════════════════

select category as 분류, count(*) as 곳
  from public.map_places
 group by category
 order by count(*) desc;
