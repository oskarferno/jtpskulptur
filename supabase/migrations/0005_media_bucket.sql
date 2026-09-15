-- Track which Storage bucket each media row actually lives in, instead of
-- callers guessing the bucket from context. Existing rows (the imported
-- sculpture photos) are backfilled to 'artwork-images', which is where the
-- import script actually put them.

alter table media
  add column bucket text not null default 'artwork-images'
  check (bucket in ('artwork-images', 'site-media', 'documents'));

alter table media alter column bucket drop default;
