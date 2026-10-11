-- JTP Skulptur — Journal content image.
--
-- Exhibitions just gained a "Content image" field (migration 0029): a
-- second, admin-managed image shown underneath the article text, separate
-- from the hero at the top, with full upload/replace/remove support in
-- Admin. Journal posts have the equivalent underneath-the-text image too
-- (post_images), but — like exhibition_images before 0029 — there is no
-- Admin UI for that table at all; it can only be set directly in the
-- database. An admin trying to add this image to a Journal post (e.g.
-- "What's left behind") has nowhere to do it.
--
-- This brings Journal to the same footing as Exhibitions: one more named
-- image slot directly on posts, same proven pattern as cover_media_id,
-- exhibitions.cover_media_id, and exhibitions.content_image_media_id.
-- post_images itself is untouched and keeps rendering exactly as it does
-- today for any post that already has a row there (e.g. "Working the
-- Clay") — this is a second, independent slot, not a replacement for it.
--
-- Nullable: NULL means "no content image", and the public page simply
-- doesn't render that section — never an empty placeholder.
--
-- on delete set null: deleting the file from the media library just clears
-- this reference rather than being blocked or leaving a dangling id.
alter table posts
  add column content_image_media_id uuid references media (id) on delete set null;

-- Access model (nothing new to grant): a column on an existing table,
-- inheriting posts' existing table privileges and its existing RLS
-- policies (public read of published rows; admin-only write). No policy or
-- GRANT is added, and none is loosened.
