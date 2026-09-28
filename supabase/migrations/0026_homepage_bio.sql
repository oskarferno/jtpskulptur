-- JTP Skulptur — separate the homepage artist bio from the About page bio.
--
-- Until now one field, about_content.full_bio, fed both places: the About
-- page rendered all of it, and the homepage's "The Artist" section rendered
-- just its first line (falling back to short_bio when full_bio was empty).
-- Editing one therefore always changed the other, and the homepage text
-- could never differ from the About page.
--
-- Naming: full_bio is kept, and simply becomes "About Page Bio" — it keeps
-- doing what it already did for the About page, so nothing that reads it
-- (including the currently deployed site, between running this migration
-- and deploying the new code) breaks. The new column is homepage_bio.
-- Renaming full_bio would have made the live About page blank in that gap.
--
-- Nullable, like every other bio field: NULL means "not set", and the
-- homepage then falls back to short_bio (its existing fallback) — never to
-- full_bio, otherwise the two fields could not be independent.
alter table about_content
  add column homepage_bio text;

-- Preserve what visitors see today: the homepage showed the first line of
-- full_bio, else short_bio. Copy exactly that, so nothing changes on
-- deploy and nothing disappears. Only fills a NULL, so re-running it can
-- never overwrite text an admin has since written. full_bio is not touched.
-- substring(... from '[^\r\n]+') = the first non-empty line.
update about_content
set homepage_bio = coalesce(substring(full_bio from '[^\r\n]+'), short_bio)
where homepage_bio is null;

-- Access model (nothing new to grant): a new column on an existing table
-- inherits about_content's table privileges and its two existing RLS
-- policies — "public can read about_content" (the homepage and About page
-- read it anonymously) and "admin can update about_content" (is_admin()
-- gates every write). No policy or GRANT is added, and none is loosened.
