-- ============================================================================
-- PICTOGRAM — Supabase / Postgres schema
-- Users, Posts, Stories (ephemeral), Account Strikes, Chat
-- Paste into Supabase SQL Editor and run top-to-bottom.
-- ============================================================================

-- Extensions we rely on
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_cron";    -- scheduled story cleanup

-- ============================================================================
-- 1. PROFILES  (1:1 extension of auth.users)
-- ============================================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  display_name  text,
  avatar_url    text,
  bio           text,
  is_business   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data, 1:1 with auth.users';

-- Auto-create a profile row whenever someone signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- 2. POSTS  (permanent feed content)
-- ============================================================================
create type public.media_type as enum ('image', 'video');

create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  media_url      text not null,          -- compressed .webp or .webm in Storage
  media_type     public.media_type not null,
  thumbnail_url  text,                   -- tiny placeholder frame, always loaded
  blurhash       text,                   -- optional blurhash string, no network needed
  caption        text,
  width          int,
  height         int,
  created_at     timestamptz not null default now()
);

create index posts_created_at_idx on public.posts (created_at desc);
create index posts_user_id_idx on public.posts (user_id);

-- ============================================================================
-- 3. STORIES  (ephemeral, auto-expire after 24h)
-- ============================================================================
create table public.stories (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  media_url      text not null,
  media_type     public.media_type not null,
  thumbnail_url  text,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '24 hours')
);

create index stories_expires_at_idx on public.stories (expires_at);
create index stories_user_id_idx on public.stories (user_id);

create table public.story_views (
  story_id   uuid not null references public.stories(id) on delete cascade,
  viewer_id  uuid not null references public.profiles(id) on delete cascade,
  viewed_at  timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

-- Cleanup function: deletes expired story rows AND their Storage objects.
-- Storage object deletion is done via the storage.objects table directly
-- (bucket: "stories"), since expired rows carry the object path in media_url.
create function public.purge_expired_stories()
returns void as $$
begin
  delete from storage.objects
  where bucket_id = 'stories'
    and name in (
      select media_url from public.stories where expires_at < now()
    );

  delete from public.stories where expires_at < now();
end;
$$ language plpgsql security definer;

-- Run the purge every 15 minutes via pg_cron
select cron.schedule(
  'purge-expired-stories',
  '*/15 * * * *',
  $$ select public.purge_expired_stories(); $$
);

-- ============================================================================
-- 4. ACCOUNT STRIKES  (transparent moderation, replaces silent shadowbans)
-- ============================================================================
create type public.strike_status as enum ('active', 'appealed', 'overturned', 'upheld');

create table public.account_strikes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  guideline_violated  text not null,       -- e.g. "Community Guideline 4.2 — Spam"
  reason              text not null,       -- human-readable explanation
  evidence_url        text,                -- optional link/screenshot of flagged content
  status              public.strike_status not null default 'active',
  appeal_text         text,
  appeal_submitted_at timestamptz,
  reviewed_at         timestamptz,
  reviewer_notes       text,
  created_at          timestamptz not null default now()
);

create index account_strikes_user_id_idx on public.account_strikes (user_id);

-- Convenience view: current standing per user
create view public.account_standing as
select
  user_id,
  count(*) filter (where status in ('active', 'upheld')) as active_strike_count,
  count(*) filter (where status = 'appealed') as pending_appeal_count
from public.account_strikes
group by user_id;

-- ============================================================================
-- 5. CHAT  (conversations, participants, messages)
-- ============================================================================
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  is_group    boolean not null default false,
  title       text,                        -- only used for group chats
  created_at  timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  joined_at        timestamptz not null default now(),
  last_read_at     timestamptz,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  content          text,
  media_url        text,                   -- optional compressed image/video attachment
  created_at       timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id, created_at);

-- ============================================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.account_strikes enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Profiles: public read, owner write
create policy "profiles_public_read" on public.profiles for select using (true);
create policy "profiles_owner_write" on public.profiles for update using (auth.uid() = id);

-- Posts: public read, owner write/delete
create policy "posts_public_read" on public.posts for select using (true);
create policy "posts_owner_insert" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_owner_delete" on public.posts for delete using (auth.uid() = user_id);

-- Stories: public read (only non-expired via app query), owner write/delete
create policy "stories_public_read" on public.stories for select using (expires_at > now());
create policy "stories_owner_insert" on public.stories for insert with check (auth.uid() = user_id);
create policy "stories_owner_delete" on public.stories for delete using (auth.uid() = user_id);

create policy "story_views_insert" on public.story_views for insert with check (auth.uid() = viewer_id);
create policy "story_views_read" on public.story_views for select using (true);

-- Strikes: ONLY the affected user can see their own — this is the whole point
create policy "strikes_owner_read" on public.account_strikes for select using (auth.uid() = user_id);
create policy "strikes_owner_appeal" on public.account_strikes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Conversations / messages: only participants can read or write
create policy "conversations_participant_read" on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

create policy "participants_self_read" on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

create policy "messages_participant_read" on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "messages_participant_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );
