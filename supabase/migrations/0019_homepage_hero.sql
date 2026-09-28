-- JTP Skulptur — homepage hero selection
--
-- Previously the hero was implicit: src/pages/index.astro picked whichever
-- published artwork was `featured` first (by display_order), or just the
-- first published artwork if none were featured. `featured` also drives the
-- "Featured Work" grid on the same page, so there was no way to control the
-- hero independently of that grid, and no admin UI for it at all — changing
-- the hero meant editing display_order/featured indirectly and hoping the
-- ordering worked out. This adds a dedicated, explicit, admin-controlled flag.

alter table artworks
  add column is_homepage_hero boolean not null default false;

-- Enforces "at most one hero" at the database level, not just in app code —
-- a partial unique index only constrains rows where the predicate holds, so
-- any number of rows can have is_homepage_hero = false, but never more than
-- one true at once.
create unique index artworks_single_hero_idx on artworks (is_homepage_hero) where is_homepage_hero;

-- Optional hero-specific image override — the homepage falls back to
-- primary_image_id when this is null, so a differently cropped/optimized
-- version can be used there without duplicating the artwork record.
alter table artworks
  add column hero_image_id uuid references media (id) on delete set null;

-- Atomically swaps the single homepage hero to a new artwork. Doing this as
-- one function call (rather than two separate UPDATEs from the API route)
-- avoids ever transiently violating the unique index above and keeps
-- "exactly one hero" a single round trip instead of two.
create function set_homepage_hero(p_artwork_id uuid)
returns void as $$
begin
  update artworks set is_homepage_hero = false where is_homepage_hero = true and id <> p_artwork_id;
  update artworks set is_homepage_hero = true, updated_at = now() where id = p_artwork_id;
end;
$$ language plpgsql;

-- Backfill: carry over whatever artwork the old implicit logic would have
-- picked (first featured, else first overall, both by display_order among
-- published artworks) so deploying this migration doesn't change what the
-- homepage shows today.
update artworks set is_homepage_hero = true
where id = (
  select id from artworks
  where published = true
  order by featured desc, display_order asc, created_at asc
  limit 1
);
