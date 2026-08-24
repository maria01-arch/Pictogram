create table public.dating_profiles (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  enabled    boolean not null default false,
  bio        text,
  updated_at timestamptz not null default now()
);
alter table public.dating_profiles enable row level security;

create policy "dating_profiles_enabled_read" on public.dating_profiles for select
  using (enabled = true or auth.uid() = user_id);
create policy "dating_profiles_owner_insert" on public.dating_profiles for insert
  with check (auth.uid() = user_id);
create policy "dating_profiles_owner_update" on public.dating_profiles for update
  using (auth.uid() = user_id);

create table public.dating_likes (
  liker_id   uuid not null references public.profiles(id) on delete cascade,
  liked_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  check (liker_id <> liked_id)
);
alter table public.dating_likes enable row level security;

create policy "dating_likes_participant_read" on public.dating_likes for select
  using (auth.uid() = liker_id or auth.uid() = liked_id);
create policy "dating_likes_owner_insert" on public.dating_likes for insert
  with check (auth.uid() = liker_id);

create table public.dating_matches (
  user_a     uuid not null references public.profiles(id) on delete cascade,
  user_b     uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.dating_matches enable row level security;

create policy "dating_matches_participant_read" on public.dating_matches for select
  using (auth.uid() = user_a or auth.uid() = user_b);

-- When two people like each other (in either order), auto-create a match.
create or replace function public.handle_dating_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reverse_exists boolean;
begin
  select exists (
    select 1 from public.dating_likes
    where liker_id = new.liked_id and liked_id = new.liker_id
  ) into reverse_exists;

  if reverse_exists then
    insert into public.dating_matches (user_a, user_b)
    values (least(new.liker_id, new.liked_id), greatest(new.liker_id, new.liked_id))
    on conflict (user_a, user_b) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_dating_like_created on public.dating_likes;
create trigger on_dating_like_created
  after insert on public.dating_likes
  for each row execute procedure public.handle_dating_like();

alter publication supabase_realtime add table public.dating_matches;
