-- Multi-image carousel posts (images only — video posts stay single-media).
alter type public.media_type add value if not exists 'carousel';

create table public.post_media (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  media_url  text not null,
  width      int,
  height     int,
  position   int not null,
  created_at timestamptz not null default now()
);
create index post_media_post_id_idx on public.post_media (post_id, position);

alter table public.post_media enable row level security;

create policy "post_media_public_read" on public.post_media for select using (true);

create policy "post_media_owner_insert" on public.post_media for insert
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );

create policy "post_media_owner_delete" on public.post_media for delete
  using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
  );
