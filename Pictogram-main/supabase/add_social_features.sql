-- Likes, comments, saves, and a proper follow graph with pending/accepted states.

create table public.likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.saves (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);
create index comments_post_id_idx on public.comments (post_id, created_at);

-- Requires approval before a follower is added — toggleable per user.
alter table public.profiles add column if not exists requires_follow_approval boolean not null default false;

create type public.follow_status as enum ('pending', 'accepted');

create table public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status       public.follow_status not null default 'accepted',
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_id_idx on public.follows (following_id, status);

-- RLS
alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

create policy "likes_public_read" on public.likes for select using (true);
create policy "likes_owner_insert" on public.likes for insert with check (auth.uid() = user_id);
create policy "likes_owner_delete" on public.likes for delete using (auth.uid() = user_id);

create policy "saves_owner_read" on public.saves for select using (auth.uid() = user_id);
create policy "saves_owner_insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "saves_owner_delete" on public.saves for delete using (auth.uid() = user_id);

create policy "comments_public_read" on public.comments for select using (true);
create policy "comments_owner_insert" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_owner_delete" on public.comments for delete using (auth.uid() = user_id);

create policy "follows_involved_read" on public.follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);
create policy "follows_follower_insert" on public.follows for insert
  with check (auth.uid() = follower_id);
create policy "follows_following_update" on public.follows for update
  using (auth.uid() = following_id);
create policy "follows_involved_delete" on public.follows for delete
  using (auth.uid() = follower_id or auth.uid() = following_id);
