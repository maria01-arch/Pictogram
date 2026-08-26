-- ============================================================
-- Chat images were world-readable: anyone with a media path
-- (predictable: {sender_id}/{uuid}-{filename}) could view any
-- chat image, not just the two participants of that conversation.
-- Fix: make the bucket private and scope SELECT to participants
-- of the conversation the image was actually sent in, via the
-- messages table. Uploads still work the same (owner-folder check).
-- ============================================================

update storage.buckets set public = false where id = 'chat-media';

drop policy if exists "chat_media_public_read" on storage.objects;

create policy "chat_media_participant_read" on storage.objects for select
  using (
    bucket_id = 'chat-media'
    and exists (
      select 1 from public.messages m
      where m.media_url = storage.objects.name
        and public.is_conversation_participant(m.conversation_id)
    )
  );

-- Note: this only protects NEW messages, since existing rows stored a full
-- public URL in media_url rather than the bare storage path. Old chat
-- images will stop resolving once this migration runs — see uploadChatImage.ts,
-- which now stores the path instead of the public URL going forward.
