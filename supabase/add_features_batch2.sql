-- ============================================================
-- FIX 1: Blocking only worked one-directionally.
-- blocked_owner_read only let you see blocks YOU created, so
-- when the BLOCKED person's own client checked "am I blocked?",
-- RLS hid the row entirely (they can't see rows where someone
-- else is the blocker). The same invisibility applied inside
-- the messages INSERT policy's subquery, so blocked users could
-- still send. Fix: security-definer function bypasses RLS for
-- this internal check, and a new read policy lets you see blocks
-- made against you (needed for the client-side "canMessage" UI).
-- ============================================================
create or replace function public.is_blocked_by_either(other_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = auth.uid() and blocked_id = other_user_id)
       or (blocker_id = other_user_id and blocked_id = auth.uid())
  );
$$;

create policy "blocked_target_read" on public.blocked_users for select using (auth.uid() = blocked_id);

drop policy if exists "messages_participant_insert" on public.messages;
create policy "messages_participant_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id)
    and not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id <> auth.uid()
        and public.is_blocked_by_either(cp.user_id)
    )
  );

-- ============================================================
-- FIX 2: Follow requests were only pending if a user manually
-- enabled "Approve new followers" in Settings, which defaulted
-- to off — so every follow auto-accepted, matching your report
-- exactly. Friends should require acceptance by default.
-- ============================================================
alter table public.profiles alter column requires_follow_approval set default true;
update public.profiles set requires_follow_approval = true;

-- ============================================================
-- Text-only posts and stories (min 100 words enforced client-side
-- for posts; no minimum for stories)
-- ============================================================
alter type public.media_type add value if not exists 'text';
alter table public.posts alter column media_url drop not null;
alter table public.posts add column if not exists text_content text;
alter table public.stories alter column media_url drop not null;
alter table public.stories add column if not exists text_content text;

-- ============================================================
-- Chat image attachments
-- ============================================================
insert into storage.buckets (id, name, public) values ('chat-media', 'chat-media', true)
  on conflict (id) do nothing;
create policy "chat_media_public_read" on storage.objects for select using (bucket_id = 'chat-media');
create policy "chat_media_participant_upload" on storage.objects for insert
  with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text);
