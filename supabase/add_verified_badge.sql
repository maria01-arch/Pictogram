alter table public.profiles add column if not exists is_verified boolean not null default false;
