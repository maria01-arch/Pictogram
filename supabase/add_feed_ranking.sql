-- Ranks posts by a blend of recency and engagement, with a small random
-- jitter so the order isn't perfectly deterministic. The client passes a
-- seed (via setseed, range -1..1) generated once per page load/refresh —
-- reusing the same seed across paginated "load more" calls within one
-- session keeps pagination internally consistent (no duplicates/skips),
-- while a fresh page load generates a new seed, genuinely reshuffling
-- the feed rather than showing the exact same order every time.
--
-- Score = recency_decay(18h half-life) * engagement_multiplier * jitter(±15%)
-- This is a first pass — no personalization/affinity yet (doesn't yet
-- weight posts from accounts you follow or engage with more heavily).
-- That's a natural next step once there's real usage data to tune against.

create or replace function public.feed_ranked_ids(page_limit int, page_offset int, seed double precision)
returns table(id uuid)
language plpgsql
as $$
begin
  perform setseed(greatest(-1, least(1, seed)));

  return query
    select p.id
    from public.posts p
    left join (
      select post_id, count(*) as like_count from public.likes group by post_id
    ) l on l.post_id = p.id
    left join (
      select post_id, count(*) as comment_count from public.comments group by post_id
    ) c on c.post_id = p.id
    where p.moderation_status = 'approved'
    order by (
      exp(-extract(epoch from (now() - p.created_at)) / (18 * 3600))
      * (1 + coalesce(l.like_count, 0) * 3 + coalesce(c.comment_count, 0) * 5)
      * (0.85 + random() * 0.3)
    ) desc
    limit page_limit offset page_offset;
end;
$$;
