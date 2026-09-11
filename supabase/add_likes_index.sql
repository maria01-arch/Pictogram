-- feed_ranked_ids() joins against likes (grouped by post_id) on every single
-- feed page load. Without this index, that's a full sequential scan of the
-- entire likes table each time — gets linearly worse as likes grow. Safe,
-- zero-risk addition.
create index if not exists likes_post_id_idx on public.likes (post_id);
