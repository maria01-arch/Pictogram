-- schema.sql only defined SELECT policies for conversations and
-- conversation_participants. RLS default-denies everything not explicitly
-- allowed, so creating a new conversation always failed.

create policy "conversations_authenticated_insert" on public.conversations
  for insert with check (auth.uid() is not null);

-- A user can insert their own participant row (joining a conversation),
-- OR add another participant to a conversation they're the creator of
-- (i.e. the conversation currently has no rows yet, or they're already in it).
create policy "participants_self_or_cocreator_insert" on public.conversation_participants
  for insert with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );
