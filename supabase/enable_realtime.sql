-- Tables must be explicitly added to the supabase_realtime publication for
-- postgres_changes subscriptions to actually fire. Just having the table
-- and RLS policies isn't enough — this was silently missing, which is why
-- messages only ever appeared after a manual refresh (a plain SELECT always
-- sees committed data; only the live broadcast was missing).
alter publication supabase_realtime add table public.messages;
