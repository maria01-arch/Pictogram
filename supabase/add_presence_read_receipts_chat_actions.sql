-- ============================================================================
-- Online indicator, read receipts (+ opt-out), swipe-to-delete/block/report
-- on the chat list.
-- ============================================================================

-- Online indicator: last_seen_at is refreshed by a client-side heartbeat
-- while the app is open and in the foreground (see usePresenceHeartbeat.ts).
-- "Online" is derived client-side as "seen within the last ~60s" rather than
-- a separate boolean — that way a killed app / closed tab just goes stale
-- on its own instead of needing a clean "I'm offline now" signal.
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Read receipts opt-out. Mutual, like WhatsApp: a sender only sees "read" on
-- their own messages if BOTH participants have this enabled — turning yours
-- off also hides others' read status from you.
alter table public.profiles add column if not exists read_receipts_enabled boolean not null default true;

-- Per-user "delete conversation" — hides it from just this user's list.
-- Existing "participants_self_update" policy (auth.uid() = user_id) already
-- covers writing this column, since RLS applies per-row, not per-column.
alter table public.conversation_participants add column if not exists hidden_at timestamptz;

-- Minimal reporting table backing the "Report" action in the chat-list swipe
-- menu. Write-only from the client — no select policy for regular users;
-- an admin review UI, if built later, would need its own policy checking
-- the admins table (same pattern as verification review).
create table if not exists public.reports (
  id                 uuid primary key default gen_random_uuid(),
  reporter_id        uuid not null references public.profiles(id) on delete cascade,
  reported_user_id   uuid not null references public.profiles(id) on delete cascade,
  conversation_id    uuid references public.conversations(id) on delete set null,
  reason             text,
  created_at         timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports_reporter_insert" on public.reports for insert
  with check (auth.uid() = reporter_id);
