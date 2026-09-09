create table if not exists public.gallery_favorites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  wallhaven_id  text not null,
  thumb_url     text not null,
  full_url      text not null,
  resolution    text,
  created_at    timestamptz not null default now(),
  unique (user_id, wallhaven_id)
);
alter table public.gallery_favorites enable row level security;
create policy "gallery_favorites_owner_all" on public.gallery_favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
