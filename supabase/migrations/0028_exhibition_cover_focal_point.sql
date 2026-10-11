-- JTP Skulptur — Exhibition cover image focal point.
--
-- The exhibition detail page's cover (src/pages/exhibitions/[slug].astro)
-- renders with object-fit: cover at a fixed height (50svh mobile, 65svh
-- desktop/laptop) and full viewport width — the same wide-crop shape as
-- the Journal article hero, and the same fix already shipped there (see
-- 0027_journal_hero_focal_point.sql): let the image carry its own focal
-- point, set once in Admin by clicking the important area of the photo,
-- applied everywhere via CSS object-position.
--
-- Scope note: exhibitions can also hold a gallery of additional images
-- (exhibition_images), but Admin → Exhibitions currently has no interface
-- to manage that gallery at all (its own comment says images are added
-- directly via the media library and the table) and the public gallery
-- renders with object-contain, which never crops. This migration only
-- covers the cover image — the one image Admin actually lets the admin
-- pick, and the one place a wide crop currently hides content.
--
-- NOT NULL with a default, matching the equivalent Journal/artwork
-- columns, so every exhibition — including ones that existed before this
-- column did — renders sensibly with no manual backfill. Default (50, 50)
-- is dead-center, per this feature's own spec.
alter table exhibitions
  add column cover_focal_x smallint not null default 50 check (cover_focal_x between 0 and 100),
  add column cover_focal_y smallint not null default 50 check (cover_focal_y between 0 and 100);

-- Access model (nothing new to grant): two columns on an existing table,
-- inheriting exhibitions' existing table privileges and its existing RLS
-- policies (public read of published rows; admin-only write). No policy or
-- GRANT is added, and none is loosened.
