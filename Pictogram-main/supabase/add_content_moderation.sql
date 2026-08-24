-- Automated content moderation: every new post/story starts 'pending' and
-- is only publicly visible once an automated scan (see the moderate-media
-- edge function) marks it 'approved'. The owner can still see their own
-- pending/flagged content (e.g. to show "under review" in their own
-- profile) — nobody else can.

create type public.moderation_status_type as enum ('pending', 'approved', 'flagged');

alter table public.posts add column if not exists moderation_status public.moderation_status_type not null default 'pending';
alter table public.stories add column if not exists moderation_status public.moderation_status_type not null default 'pending';

-- Anything posted before this migration existed is grandfathered in as approved
-- so existing content doesn't vanish from the feed.
update public.posts set moderation_status = 'approved';
update public.stories set moderation_status = 'approved';

drop policy if exists "posts_public_read" on public.posts;
create policy "posts_public_read" on public.posts for select
  using (moderation_status = 'approved' or auth.uid() = user_id);

drop policy if exists "posts_owner_insert" on public.posts;
create policy "posts_owner_insert" on public.posts for insert
  with check (auth.uid() = user_id and (moderation_status = 'pending' or media_type = 'text'));

drop policy if exists "stories_public_read" on public.stories;
create policy "stories_public_read" on public.stories for select
  using (expires_at > now() and (moderation_status = 'approved' or auth.uid() = user_id));

drop policy if exists "stories_owner_insert" on public.stories;
create policy "stories_owner_insert" on public.stories for insert
  with check (auth.uid() = user_id and (moderation_status = 'pending' or media_type = 'text'));

-- Regular users (anon/authenticated roles) get no UPDATE policy on this column —
-- only the moderate-media edge function, using the service-role key which
-- bypasses RLS entirely, can move a row from 'pending' to 'approved'/'flagged'.
--
-- Exception: text-only posts/stories (media_type = 'text') have nothing for
-- Sightengine to scan, so the client marks them 'approved' directly at
-- insert time. If you later want text-content moderation too, tighten the
-- insert policy back to always require 'pending' and scan text server-side
-- the same way images are scanned.
