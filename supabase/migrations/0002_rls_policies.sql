-- JTP Skulptur — Row Level Security
-- Public (anon + authenticated non-admin) can only READ published content.
-- All writes require an authenticated user with a matching admin profile row.

alter table profiles enable row level security;
alter table media enable row level security;
alter table categories enable row level security;
alter table artworks enable row level security;
alter table artwork_images enable row level security;
alter table exhibitions enable row level security;
alter table exhibition_images enable row level security;
alter table posts enable row level security;
alter table post_images enable row level security;
alter table social_links enable row level security;
alter table site_settings enable row level security;
alter table about_content enable row level security;
alter table contact_messages enable row level security;

-- Helper: is the current JWT an admin (has a profiles row)?
create function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer set search_path = public;

-- profiles: admin can read/manage only their own row
create policy "admin can read own profile" on profiles
  for select using (auth.uid() = id);
create policy "admin can manage own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- media: public read, admin write
create policy "public can read media" on media
  for select using (true);
create policy "admin can manage media" on media
  for all using (is_admin()) with check (is_admin());

-- categories: public read, admin write
create policy "public can read categories" on categories
  for select using (true);
create policy "admin can manage categories" on categories
  for all using (is_admin()) with check (is_admin());

-- artworks: public reads published only, admin reads/writes everything
create policy "public can read published artworks" on artworks
  for select using (published = true);
create policy "admin can read all artworks" on artworks
  for select using (is_admin());
create policy "admin can manage artworks" on artworks
  for insert with check (is_admin());
create policy "admin can update artworks" on artworks
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete artworks" on artworks
  for delete using (is_admin());

-- artwork_images: follow parent artwork's publish state
create policy "public can read images of published artworks" on artwork_images
  for select using (
    exists (select 1 from artworks a where a.id = artwork_id and a.published = true)
  );
create policy "admin can read all artwork_images" on artwork_images
  for select using (is_admin());
create policy "admin can manage artwork_images" on artwork_images
  for insert with check (is_admin());
create policy "admin can update artwork_images" on artwork_images
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete artwork_images" on artwork_images
  for delete using (is_admin());

-- exhibitions: public reads published only
create policy "public can read published exhibitions" on exhibitions
  for select using (published = true);
create policy "admin can read all exhibitions" on exhibitions
  for select using (is_admin());
create policy "admin can manage exhibitions" on exhibitions
  for insert with check (is_admin());
create policy "admin can update exhibitions" on exhibitions
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete exhibitions" on exhibitions
  for delete using (is_admin());

-- exhibition_images: follow parent exhibition's publish state
create policy "public can read images of published exhibitions" on exhibition_images
  for select using (
    exists (select 1 from exhibitions e where e.id = exhibition_id and e.published = true)
  );
create policy "admin can read all exhibition_images" on exhibition_images
  for select using (is_admin());
create policy "admin can manage exhibition_images" on exhibition_images
  for insert with check (is_admin());
create policy "admin can update exhibition_images" on exhibition_images
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete exhibition_images" on exhibition_images
  for delete using (is_admin());

-- posts: public reads published only
create policy "public can read published posts" on posts
  for select using (published = true);
create policy "admin can read all posts" on posts
  for select using (is_admin());
create policy "admin can manage posts" on posts
  for insert with check (is_admin());
create policy "admin can update posts" on posts
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete posts" on posts
  for delete using (is_admin());

-- post_images: follow parent post's publish state
create policy "public can read images of published posts" on post_images
  for select using (
    exists (select 1 from posts p where p.id = post_id and p.published = true)
  );
create policy "admin can read all post_images" on post_images
  for select using (is_admin());
create policy "admin can manage post_images" on post_images
  for insert with check (is_admin());
create policy "admin can update post_images" on post_images
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete post_images" on post_images
  for delete using (is_admin());

-- social_links: public reads published only
create policy "public can read published social_links" on social_links
  for select using (published = true);
create policy "admin can read all social_links" on social_links
  for select using (is_admin());
create policy "admin can manage social_links" on social_links
  for insert with check (is_admin());
create policy "admin can update social_links" on social_links
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete social_links" on social_links
  for delete using (is_admin());

-- site_settings: public read (single row), admin write
create policy "public can read site_settings" on site_settings
  for select using (true);
create policy "admin can update site_settings" on site_settings
  for update using (is_admin()) with check (is_admin());

-- about_content: public read (single row), admin write
create policy "public can read about_content" on about_content
  for select using (true);
create policy "admin can update about_content" on about_content
  for update using (is_admin()) with check (is_admin());

-- contact_messages: no public access at all. Inserts happen server-side via
-- the service role key (see src/pages/api/contact.ts), which bypasses RLS.
create policy "admin can read contact_messages" on contact_messages
  for select using (is_admin());
create policy "admin can update contact_messages" on contact_messages
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete contact_messages" on contact_messages
  for delete using (is_admin());
