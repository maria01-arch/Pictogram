create type public.notification_type as enum ('like', 'comment', 'message', 'follow_request', 'follow_accepted');

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  actor_id        uuid not null references public.profiles(id) on delete cascade,
  type            public.notification_type not null,
  post_id         uuid references public.posts(id) on delete cascade,
  comment_id      uuid references public.comments(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  read            boolean not null default false,
  created_at      timestamptz not null default now(),
  check (actor_id <> user_id)
);
create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "notifications_owner_read" on public.notifications for select
  using (auth.uid() = user_id);
create policy "notifications_actor_insert" on public.notifications for insert
  with check (auth.uid() = actor_id);
create policy "notifications_owner_update" on public.notifications for update
  using (auth.uid() = user_id);

alter publication supabase_realtime add table public.notifications;
