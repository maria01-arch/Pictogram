-- Separate from the main feed-frame crop (which is baked directly into the
-- compressed file at upload time). This is specifically for squaring an
-- already-4:5/16:9 post down to 1:1 for the profile grid — a plain center
-- crop of an already-cropped frame can still cut off a head or on-image
-- text if the subject isn't dead-center, so creators get their own
-- adjustable focal point just for this square crop.

alter table public.posts add column if not exists cover_focal_x numeric not null default 0.5 check (cover_focal_x >= 0 and cover_focal_x <= 1);
alter table public.posts add column if not exists cover_focal_y numeric not null default 0.5 check (cover_focal_y >= 0 and cover_focal_y <= 1);
