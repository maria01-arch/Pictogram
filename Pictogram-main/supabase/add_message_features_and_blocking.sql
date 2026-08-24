-- Messages: support reply-to, edit tracking, and owner update/delete
-- (schema.sql never granted these — only insert/read existed).
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists edited_at timestamptz;

create policy "messages_owner_update" on public.messages for update
  using (auth.uid() = sender_id) with check (auth.uid() = sender_id);
create policy "messages_owner_delete" on public.messages for delete
  using (auth.uid() = sender_id);

-- Emoji reactions
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
alter table public.message_reactions enable row level security;

create policy "reactions_participant_read" on public.message_reactions for select
  using (exists (
    select 1 from public.messages m
    where m.id = message_id and public.is_conversation_participant(m.conversation_id)
  ));
create policy "reactions_participant_insert" on public.message_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_participant(m.conversation_id)
    )
  );
create policy "reactions_owner_delete" on public.message_reactions for delete
  using (auth.uid() = user_id);

-- Blocking
create table public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocked_users enable row level security;

create policy "blocked_owner_read" on public.blocked_users for select using (auth.uid() = blocker_id);
create policy "blocked_owner_insert" on public.blocked_users for insert with check (auth.uid() = blocker_id);
create policy "blocked_owner_delete" on public.blocked_users for delete using (auth.uid() = blocker_id);

-- Prevent sending a message into a conversation with anyone who has a block
-- relationship (either direction) with the sender.
drop policy if exists "messages_participant_insert" on public.messages;
create policy "messages_participant_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id <> auth.uid()
        and (
          exists (select 1 from public.blocked_users b where b.blocker_id = cp.user_id and b.blocked_id = auth.uid())
          or exists (select 1 from public.blocked_users b where b.blocker_id = auth.uid() and b.blocked_id = cp.user_id)
        )
    )
  );

alter publication supabase_realtime add table public.message_reactions;
