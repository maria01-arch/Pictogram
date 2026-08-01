-- Needed so a user can mark a conversation as read (used for the unread
-- chat badge count) — schema.sql never granted an update policy here.
create policy "participants_self_update" on public.conversation_participants for update
  using (auth.uid() = user_id);
