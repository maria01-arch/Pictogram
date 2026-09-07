-- ============================================================================
-- Route "Report" (chat-list swipe action) into the admin panel, and let
-- admins issue account strikes from a report, notifying the struck user.
-- ============================================================================

-- Reports were write-only from the client (insert only) — admins need to
-- actually read and act on them.
alter table public.reports add column if not exists status text not null default 'open' check (status in ('open', 'actioned', 'dismissed'));

create policy "reports_admin_read" on public.reports for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

create policy "reports_admin_update" on public.reports for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- account_strikes had a read/appeal policy for the owner, but no INSERT
-- policy at all — meaning nobody, including admins, could actually issue a
-- strike through the app until now.
create policy "strikes_admin_insert" on public.account_strikes for insert
  with check (exists (select 1 from public.admins where user_id = auth.uid()));

-- New notification type so a struck user gets notified. Using it in the app
-- code happens in a separate later transaction, so the usual "can't use a
-- brand-new enum value in the same transaction it was added in" restriction
-- doesn't apply here.
alter type public.notification_type add value if not exists 'account_strike';
