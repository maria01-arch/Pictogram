-- The original participants_self_read policy queried conversation_participants
-- from within its own USING clause, causing Postgres to recurse infinitely
-- trying to evaluate the policy against itself. Fix: a SECURITY DEFINER
-- function runs with elevated privileges and bypasses RLS internally,
-- breaking the recursive loop.

create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = target_conversation_id
      and user_id = auth.uid()
  );
$$;

drop policy if exists "participants_self_read" on public.conversation_participants;
create policy "participants_self_read" on public.conversation_participants
  for select using (public.is_conversation_participant(conversation_id));

drop policy if exists "conversations_participant_read" on public.conversations;
create policy "conversations_participant_read" on public.conversations
  for select using (public.is_conversation_participant(id));

drop policy if exists "messages_participant_read" on public.messages;
create policy "messages_participant_read" on public.messages
  for select using (public.is_conversation_participant(conversation_id));

drop policy if exists "messages_participant_insert" on public.messages;
create policy "messages_participant_insert" on public.messages
  for insert with check (
    auth.uid() = sender_id and public.is_conversation_participant(conversation_id)
  );
