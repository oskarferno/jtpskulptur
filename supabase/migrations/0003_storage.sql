-- JTP Skulptur — Storage buckets
-- Dedicated JTP buckets only. No relation to any other project's Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('artwork-images', 'artwork-images', true, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('site-media', 'site-media', true, 20971520, array['image/jpeg', 'image/png', 'image/webp']),
  ('documents', 'documents', true, 20971520, array['application/pdf']);

-- Public read on all three buckets (images/CV are meant to be publicly viewable)
create policy "public can read artwork-images" on storage.objects
  for select using (bucket_id = 'artwork-images');
create policy "public can read site-media" on storage.objects
  for select using (bucket_id = 'site-media');
create policy "public can read documents" on storage.objects
  for select using (bucket_id = 'documents');

-- Admin-only write access, gated by the same is_admin() helper as the DB tables
create policy "admin can upload artwork-images" on storage.objects
  for insert with check (bucket_id = 'artwork-images' and is_admin());
create policy "admin can update artwork-images" on storage.objects
  for update using (bucket_id = 'artwork-images' and is_admin());
create policy "admin can delete artwork-images" on storage.objects
  for delete using (bucket_id = 'artwork-images' and is_admin());

create policy "admin can upload site-media" on storage.objects
  for insert with check (bucket_id = 'site-media' and is_admin());
create policy "admin can update site-media" on storage.objects
  for update using (bucket_id = 'site-media' and is_admin());
create policy "admin can delete site-media" on storage.objects
  for delete using (bucket_id = 'site-media' and is_admin());

create policy "admin can upload documents" on storage.objects
  for insert with check (bucket_id = 'documents' and is_admin());
create policy "admin can update documents" on storage.objects
  for update using (bucket_id = 'documents' and is_admin());
create policy "admin can delete documents" on storage.objects
  for delete using (bucket_id = 'documents' and is_admin());
