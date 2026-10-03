-- ─────────────────────────────────────────────────────────────
--  skyish.kr Supabase (qmdovjlxfvinknuizelw) 에서 한 번 실행하세요
--  Gallery 노트 (Architects · Architecture · Renovation · Regeneration) 의
--  항목별 그림 더하기 · 빼기
--
--  · action = 'add'  : 그림 더하기 — 올린 파일(storage_path) 또는 인터넷 그림 주소(url)
--  · action = 'hide' : 원래 실려 있던 그림 빼기 — url 에 그 그림 주소
--  · 읽기: 승인된 회원 / 쓰기 · 지우기: 관리자만
--  · 올린 파일은 기존 비공개 보관함 'gallery' 의 notes/ 폴더에 들어갑니다 (회원만 열람)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.note_images (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,                 -- architects · buildings · renovation · regeneration
  note_id      text not null,                 -- 노트 id (예: tate-modern)
  section      text not null,                 -- 항목 (s1, s2 … — 화면의 1) 2) … 차례)
  action       text not null default 'add' check (action in ('add', 'hide')),
  url          text,                          -- 인터넷 그림 주소 (add) 또는 뺄 그림 주소 (hide)
  storage_path text,                          -- 올린 파일 경로 (gallery 보관함)
  caption      text,
  source       text,                          -- 출처 페이지 주소
  sort         int  not null default 0,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists note_images_note on public.note_images (kind, note_id);

alter table public.note_images enable row level security;

drop policy if exists "note images read"   on public.note_images;
drop policy if exists "note images write"  on public.note_images;
drop policy if exists "note images update" on public.note_images;
drop policy if exists "note images delete" on public.note_images;
create policy "note images read"   on public.note_images for select using (public.is_approved());
create policy "note images write"  on public.note_images for insert with check (public.is_admin());
create policy "note images update" on public.note_images for update using (public.is_admin());
create policy "note images delete" on public.note_images for delete using (public.is_admin());

-- 확인
select count(*) as 노트그림_행수 from public.note_images;
