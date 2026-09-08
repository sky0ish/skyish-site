-- ═══════════════════════════════════════════════════════════
--  사진첩을 비공개로 — 로그인·승인된 분만 보게 합니다
--
--    어디에?  skyish.kr 쪽 Supabase 프로젝트 (u-tokyo 아님)
--    어떻게?  대시보드 → SQL Editor → 아래를 통째로 붙여넣고 Run
--
--  왜 하는가
--    여태 gallery 보관함이 **공개(Public)** 였습니다. 주소만 알면
--    로그인하지 않아도 사진이 그대로 열렸습니다. 회의 사진과 답사 사진에는
--    다른 분들 얼굴이 담깁니다. 앨범 이름에도 만난 분들 성함이 들어갑니다.
--
--  무엇이 바뀌는가
--    ① 보관함이 비공개가 됩니다 — 옛 공개 주소는 더 이상 안 열립니다.
--    ② 화면은 볼 때마다 **서명된 주소**를 받아 그립니다 (gallery.js).
--       서명된 주소는 네 시간만 살아 있고, 승인된 분에게만 나옵니다.
--    ③ 사진첩 목록(표)도 승인된 분만 읽습니다 — 앨범 이름조차 안 보입니다.
--
--  ※ 이 SQL 을 실행하기 **전에** 홈페이지를 먼저 올려두셔야
--     사진이 잠깐이라도 안 보이는 일이 없습니다.
--     (옛 화면은 공개 주소로 그리기 때문입니다.)
-- ═══════════════════════════════════════════════════════════


-- ── 0) 승인 여부를 묻는 함수 — 이미 있으면 그대로 둡니다 ──
create or replace function public.is_approved()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select analysis_access or is_admin
                         from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public
as $$ select coalesce((select is_admin
                         from public.profiles where id = auth.uid()), false) $$;


-- ── 1) 보관함을 비공개로 ─────────────────────────────────────
--     이 한 줄이 권한 때문에 막히면, 대시보드에서
--       Storage → gallery → ⋯ → Edit bucket → Public bucket 끄기(OFF)
update storage.buckets set public = false where id = 'gallery';


-- ── 2) 사진 파일 열람 — 승인된 분만 ──────────────────────────
--     비공개 보관함에서는 select 규칙이 있어야 서명된 주소를 받습니다.
drop policy if exists "gallery read for members"  on storage.objects;
create policy "gallery read for members" on storage.objects
  for select using (bucket_id = 'gallery' and public.is_approved());

--     올리기·지우기는 하던 그대로입니다 (없으면 새로 만듭니다)
drop policy if exists "gallery upload for members" on storage.objects;
create policy "gallery upload for members" on storage.objects
  for insert with check (bucket_id = 'gallery' and public.is_approved());

drop policy if exists "gallery manage own" on storage.objects;
create policy "gallery manage own" on storage.objects
  for delete using (bucket_id = 'gallery' and (owner = auth.uid() or public.is_admin()));


-- ── 3) 사진첩 목록도 승인된 분만 ─────────────────────────────
--     앨범 이름에 만난 분들 성함이 들어갑니다. 설명글도 마찬가지입니다.
drop policy if exists "read albums" on public.gallery_albums;
create policy "read albums" on public.gallery_albums
  for select using (public.is_approved());

drop policy if exists "read photos" on public.gallery_photos;
create policy "read photos" on public.gallery_photos
  for select using (public.is_approved());


-- ═══════════════════════════════════════════════════════════
--  4) 잘 되었는지 확인
-- ═══════════════════════════════════════════════════════════
select
  (select public from storage.buckets where id='gallery')          as 보관함_공개여부,
  (select count(*) from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname like 'gallery %')                            as 보관함_규칙,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='gallery_albums')     as 사진첩_규칙,
  (select count(*) from pg_policies
     where schemaname='public' and tablename='gallery_photos')     as 사진_규칙;

--  기대값 : 보관함_공개여부 false · 보관함_규칙 3 · 사진첩_규칙 4 · 사진_규칙 4


-- ═══════════════════════════════════════════════════════════
--  5) 정말 잠겼는지 밖에서 두드려 보기 (컴퓨터 명령창에서)
--
--    curl -s -o /dev/null -w "%{http_code}\n" \
--      "https://<프로젝트>.supabase.co/storage/v1/object/public/gallery/<아무 경로>"
--
--    400 이나 404 가 나오면 잠긴 것입니다. 200 이면 아직 공개입니다.
-- ═══════════════════════════════════════════════════════════
