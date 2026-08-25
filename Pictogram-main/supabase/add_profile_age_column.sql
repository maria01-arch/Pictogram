alter table public.profiles add column if not exists age int;
alter table public.profiles add constraint profiles_age_reasonable check (age is null or (age >= 13 and age <= 120));
