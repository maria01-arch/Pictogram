-- Enforce one reaction per user per message instead of one per emoji.
delete from public.message_reactions a
using public.message_reactions b
where a.message_id = b.message_id
  and a.user_id = b.user_id
  and a.created_at < b.created_at;

alter table public.message_reactions drop constraint message_reactions_pkey;
alter table public.message_reactions add primary key (message_id, user_id);
