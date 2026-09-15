-- JTP Skulptur — add fields exhibitions needs to support individual detail
-- pages, matching the pattern already used by posts/artworks (slug, cover
-- image, short intro, optional SEO overrides).

alter table exhibitions
  add column slug text unique,
  add column intro text,
  add column cover_media_id uuid references media (id) on delete set null,
  add column seo_title text,
  add column seo_description text;

create index exhibitions_slug_idx on exhibitions (slug);
