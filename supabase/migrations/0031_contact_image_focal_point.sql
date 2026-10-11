-- JTP Skulptur — Contact page hero image focal point.
--
-- The Contact page's side image (Admin → Site Settings → Contact Page
-- Image) has always used a fixed object-top crop. This lets it carry its
-- own focal point instead, same pattern as the homepage hero
-- (artworks.hero_focal_x/y), the Journal article hero
-- (posts.hero_focal_x/y) and the Exhibition cover (exhibitions.cover_focal_x/y):
-- set once in Admin by clicking the important area of the photo, applied
-- everywhere via CSS object-position.
--
-- NOT NULL with a default, matching those columns, so every existing site
-- (including today's) renders with no manual backfill. Default is (50, 0)
-- — center horizontally, top vertically — which is exactly what CSS
-- object-top already resolves to, so this changes nothing visually until
-- an admin explicitly picks a different point.
alter table site_settings
  add column contact_image_focal_x smallint not null default 50 check (contact_image_focal_x between 0 and 100),
  add column contact_image_focal_y smallint not null default 0 check (contact_image_focal_y between 0 and 100);

-- Access model (nothing new to grant): two columns on an existing table,
-- inheriting site_settings' existing table privileges and its existing RLS
-- policies ("public can read site_settings"; "admin can update site_settings").
-- No policy or GRANT is added, and none is loosened.
