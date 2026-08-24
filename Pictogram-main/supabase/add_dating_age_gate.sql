-- Dating isn't a core feature and previously had no age gate at all —
-- signup itself never asks for a date of birth. Rather than collect a DOB
-- (extra sensitive data to store/secure), require an explicit 18+
-- self-attestation, timestamped, before a dating_profiles row can be
-- enabled. Self-attestation isn't a hard legal age-verification control,
-- but it's the same baseline most consumer apps use and is a big step up
-- from "no gate at all."

alter table public.dating_profiles
  add column if not exists age_confirmed_at timestamptz;

-- A row can only be enabled once the user has confirmed. Existing rows
-- (if any) with enabled = true but no confirmation are turned off until
-- the user re-confirms through the app.
update public.dating_profiles set enabled = false where age_confirmed_at is null;

alter table public.dating_profiles
  add constraint dating_profiles_enabled_requires_age_confirmation
  check (not enabled or age_confirmed_at is not null);
