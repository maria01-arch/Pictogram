-- follows_involved_read only let the two people in a follow relationship see
-- it, which broke public follower/following counts on profiles — anyone
-- viewing someone else's profile got 0 for both. Add a second permissive
-- policy (Postgres OR's multiple SELECT policies together) that opens up
-- read access for *accepted* follows only — pending requests stay private
-- between the two parties via the existing policy.

create policy "follows_accepted_public_read" on public.follows for select
  using (status = 'accepted');
