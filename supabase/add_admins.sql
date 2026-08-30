-- A dedicated table rather than an `is_admin` column on profiles — a
-- boolean on a broadly-selected public table is an easy thing to
-- accidentally expose in a query response. This table has no INSERT/
-- UPDATE/DELETE policy for the authenticated role at all, so the only
-- way to grant admin access is running SQL directly in the Supabase
-- dashboard — nobody can grant it to themselves or anyone else through
-- the app, ever. The one SELECT policy only lets a user confirm THEIR
-- OWN admin status, never look up anyone else's.

create table public.admins (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "admins_self_read" on public.admins for select
  using (auth.uid() = user_id);

-- Admins can read and review every verification application, not just
-- their own.
create policy "verification_admin_read" on public.verification_applications for select
  using (exists (select 1 from public.admins where user_id = auth.uid()));

create policy "verification_admin_update" on public.verification_applications for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- Admins can view the actual ID/payment-proof files during review, not
-- just the applicant themselves.
create policy "verification_docs_admin_read" on storage.objects for select
  using (
    bucket_id = 'verification-docs'
    and exists (select 1 from public.admins where user_id = auth.uid())
  );

-- Approving an application needs to flip is_verified on someone else's
-- profile — the existing profiles update policy is owner-only, so admins
-- need their own grant for this.
create policy "profiles_admin_update" on public.profiles for update
  using (exists (select 1 from public.admins where user_id = auth.uid()));

-- To make yourself an admin, run this manually in the Supabase SQL editor
-- (replace with your actual user id from auth.users):
--   insert into public.admins (user_id) values ('YOUR-USER-UUID-HERE');
