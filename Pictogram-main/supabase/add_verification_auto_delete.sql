-- Once an admin reviews a verification application (approves or rejects),
-- the sensitive ID photo and payment screenshot are no longer needed and
-- become pure liability if they sit in storage indefinitely. Delete them
-- immediately on review and null out the path columns, keeping only the
-- decision itself (status, reviewer_notes, reviewed_at) for the record.
--
-- Note: this requires reviewed_at to be set by whatever marks the
-- application approved/rejected (the future admin panel should set it in
-- the same update that changes status).

create or replace function public.purge_verification_docs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected') and old.status = 'pending' then
    if old.id_document_url is not null then
      delete from storage.objects where bucket_id = 'verification-docs' and name = old.id_document_url;
    end if;
    if old.tx_screenshot_url is not null then
      delete from storage.objects where bucket_id = 'verification-docs' and name = old.tx_screenshot_url;
    end if;

    new.id_document_url := null;
    new.tx_screenshot_url := null;
    if new.reviewed_at is null then
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_purge_verification_docs on public.verification_applications;
create trigger trg_purge_verification_docs
  before update on public.verification_applications
  for each row
  execute function public.purge_verification_docs();

-- id_document_url was `not null` at insert time but is nulled out post-review,
-- so it needs to allow null going forward.
alter table public.verification_applications alter column id_document_url drop not null;
