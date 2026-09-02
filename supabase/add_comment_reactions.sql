-- One active reaction per user per comment (tapping the same emoji again
-- removes it, tapping a different one replaces it) — same model as
-- message_reactions in chat, just for comments instead.

create table public.comment_reactions (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_reactions enable row level security;

create policy "comment_reactions_public_read" on public.comment_reactions for select using (true);
create policy "comment_reactions_owner_insert" on public.comment_reactions for insert with check (auth.uid() = user_id);
create policy "comment_reactions_owner_update" on public.comment_reactions for update using (auth.uid() = user_id);
create policy "comment_reactions_owner_delete" on public.comment_reactions for delete using (auth.uid() = user_id);
