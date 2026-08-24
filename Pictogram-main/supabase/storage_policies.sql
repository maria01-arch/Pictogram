-- Creates the two Storage buckets the app uploads into, and locks them
-- down so users can only write into their own folder (path = "{user_id}/...").

insert into storage.buckets (id, name, public) values ('posts', 'posts', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('stories', 'stories', true)
  on conflict (id) do nothing;

create policy "posts_bucket_public_read" on storage.objects
  for select using (bucket_id = 'posts');
create policy "stories_bucket_public_read" on storage.objects
  for select using (bucket_id = 'stories');

create policy "posts_bucket_owner_upload" on storage.objects
  for insert with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "stories_bucket_owner_upload" on storage.objects
  for insert with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "posts_bucket_owner_delete" on storage.objects
  for delete using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "stories_bucket_owner_delete" on storage.objects
  for delete using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
