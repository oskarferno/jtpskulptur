-- JTP Skulptur — Journal post hero image focal point.
--
-- The Journal article hero (src/pages/journal/[slug].astro) renders the
-- cover image with object-fit: cover at a fixed height (50svh mobile,
-- 65svh desktop/laptop) and full viewport width — on a wide desktop
-- window this crops a lot of the image, and a fixed object-top crop can
-- hide the actual subject (e.g. "Surface Notes", where the figure sits
-- low in the frame). Same problem and same fix already shipped for the
-- homepage hero (see 0021_hero_focal_point.sql): let each image carry its
-- own focal point, set once in Admin by clicking the important area of
-- the photo, applied everywhere via CSS object-position.
--
-- NOT NULL with a default, like the artwork columns, so every post —
-- including ones that existed before this column did — renders sensibly
-- with no manual backfill required. Default (50, 50) is dead-center, per
-- this feature's own spec (the artwork hero instead defaults to top,
-- 50/0, per that separate feature's own spec) — center is a reasonable
-- neutral guess for an arbitrary photograph.
alter table posts
  add column hero_focal_x smallint not null default 50 check (hero_focal_x between 0 and 100),
  add column hero_focal_y smallint not null default 50 check (hero_focal_y between 0 and 100);

-- Access model (nothing new to grant): two columns on an existing table,
-- inheriting posts' existing table privileges and its existing RLS
-- policies — "public can read published posts" (the Journal article page
-- reads them anonymously) and "admin can update posts" (is_admin() gates
-- every write). No policy or GRANT is added, and none is loosened.
