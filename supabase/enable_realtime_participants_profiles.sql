-- Read receipts and the online dot depend on realtime UPDATE events for
-- these two tables. If they were never added to Supabase's realtime
-- publication, subscribing to them silently does nothing — this makes sure
-- they're actually enabled. Safe to run even if they're already enabled.
alter publication supabase_realtime add table public.conversation_participants;
alter publication supabase_realtime add table public.profiles;
