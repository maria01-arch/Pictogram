-- TEMPORARY: content moderation is fully built (see add_content_moderation.sql
-- + the moderate-media edge function) but the edge function isn't deployed yet,
-- which means every new post/story gets stuck at 'pending' forever — invisible
-- to anyone but its owner. That blocks normal testing, so this migration
-- switches new uploads back to auto-approved until the edge function is
-- deployed and you're ready to turn enforcement back on.
--
-- TO RE-ENABLE LATER: once moderate-media is deployed (see earlier
-- instructions — supabase functions deploy moderate-media + secrets), just
-- re-run add_content_moderation.sql again. It will reset the default back
-- to 'pending' and restore the strict insert policies.

alter table public.posts alter column moderation_status set default 'approved';
alter table public.stories alter column moderation_status set default 'approved';

drop policy if exists "posts_owner_insert" on public.posts;
create policy "posts_owner_insert" on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "stories_owner_insert" on public.stories;
create policy "stories_owner_insert" on public.stories for insert
  with check (auth.uid() = user_id);

-- Also approve anything that already got stuck as pending from earlier testing.
update public.posts set moderation_status = 'approved' where moderation_status = 'pending';
update public.stories set moderation_status = 'approved' where moderation_status = 'pending';
