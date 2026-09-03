-- The original trigger tried `delete from storage.objects ...` directly in
-- SQL. Supabase blocks that (error 42501: "Direct deletion from storage
-- tables is not allowed. Use the Storage API instead.") — and because this
-- ran inside a BEFORE UPDATE trigger, that failure rolled back the entire
-- approve/reject update, silently. This is why clicking Approve/Reject did
-- nothing: the update never actually committed.
--
-- Fix: the trigger no longer touches storage at all — it just stamps
-- reviewed_at. Actual file deletion now happens from the app via the
-- Storage API (supabase.storage...remove()), which is the only method
-- Supabase allows for this.

create or replace function public.purge_verification_docs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected') and old.status = 'pending' then
    if new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- Admins need to actually delete the objects via the Storage API, which
-- checks this DELETE policy — the earlier migration only granted SELECT.
create policy "verification_docs_admin_delete" on storage.objects for delete
  using (
    bucket_id = 'verification-docs'
    and exists (select 1 from public.admins where user_id = auth.uid())
  );
