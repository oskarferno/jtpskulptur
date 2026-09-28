-- JTP Skulptur — homepage hero focal point
--
-- The homepage hero (src/pages/index.astro) renders whichever image is
-- selected via object-fit: cover at a full-viewport, highly variable
-- aspect ratio (very wide and short on desktop, narrower and tall on
-- mobile). A single hardcoded object-position could crop the sculpture's
-- head on some photographs — this lets each hero image carry its own
-- focal point instead, set once in Admin → Portfolio → Edit Artwork by
-- clicking the important area of the photo (normally the head), reused
-- responsively everywhere via CSS object-position.
--
-- NOT NULL with a default rather than nullable: every artwork — including
-- ones that existed before this column did — should render sensibly on
-- the homepage without requiring a manual backfill. Default (50, 0) is
-- "center top", which per the task brief is a safer starting crop for a
-- sculpture photograph than dead-center (50, 50).
alter table artworks
  add column hero_focal_x smallint not null default 50 check (hero_focal_x between 0 and 100),
  add column hero_focal_y smallint not null default 0 check (hero_focal_y between 0 and 100);

-- Configures the current homepage hero (Crows) so its head is fully
-- visible with a small margin above it, rather than patching this with
-- one-off CSS — measured directly from the source photograph: the
-- topmost figure's head begins at y=5.3% of the image height, centered
-- at x=60%.
update artworks set hero_focal_x = 60, hero_focal_y = 8 where slug = 'crows';
