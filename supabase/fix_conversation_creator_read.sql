-- INSERT ... RETURNING is subject to SELECT RLS in Postgres. A brand-new
-- conversation has no participant rows yet at the instant of insert, so
-- the existing read policy correctly (but unhelpfully) blocks the creator
-- from reading back their own new row. Track the creator and allow them
-- to read it regardless of participant rows.

alter table public.conversations add column if not exists created_by uuid references public.profiles(id);

alter table public.conversations alter column created_by set default auth.uid();

drop policy if exists "conversations_participant_read" on public.conversations;
create policy "conversations_participant_read" on public.conversations
  for select using (
    public.is_conversation_participant(id) or created_by = auth.uid()
  );
