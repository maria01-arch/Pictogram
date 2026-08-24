create type public.payment_method_type as enum ('card', 'crypto');
create type public.crypto_currency_type as enum ('BTC', 'USDT_TRC20', 'ETH', 'USDT_ERC20', 'XRP');
create type public.verification_status as enum ('pending', 'approved', 'rejected');

create table public.verification_applications (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  full_name        text not null,
  statement        text,
  id_document_url  text not null,
  payment_method   public.payment_method_type not null,
  crypto_currency  public.crypto_currency_type,
  tx_screenshot_url text,
  status           public.verification_status not null default 'pending',
  reviewer_notes   text,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index verification_applications_user_id_idx on public.verification_applications (user_id);

alter table public.verification_applications enable row level security;

create policy "verification_owner_read" on public.verification_applications for select
  using (auth.uid() = user_id);
create policy "verification_owner_insert" on public.verification_applications for insert
  with check (auth.uid() = user_id);

-- ID documents and payment proof are sensitive — this bucket is NOT public,
-- unlike posts/stories/avatars/chat-media. Only the uploader can read their
-- own files back.
insert into storage.buckets (id, name, public) values ('verification-docs', 'verification-docs', false)
  on conflict (id) do nothing;

create policy "verification_docs_owner_read" on storage.objects for select
  using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "verification_docs_owner_upload" on storage.objects for insert
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
