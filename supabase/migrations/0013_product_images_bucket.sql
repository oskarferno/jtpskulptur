-- JTP Skulptur — product images storage bucket, same public-read/admin-write
-- pattern as the existing three buckets (0003_storage.sql).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 20971520, array['image/jpeg', 'image/png', 'image/webp']);

create policy "public can read product-images" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "admin can upload product-images" on storage.objects
  for insert with check (bucket_id = 'product-images' and is_admin());
create policy "admin can update product-images" on storage.objects
  for update using (bucket_id = 'product-images' and is_admin());
create policy "admin can delete product-images" on storage.objects
  for delete using (bucket_id = 'product-images' and is_admin());

alter table media drop constraint if exists media_bucket_check;
alter table media add constraint media_bucket_check
  check (bucket in ('artwork-images', 'site-media', 'documents', 'product-images'));
