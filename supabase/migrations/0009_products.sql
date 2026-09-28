-- JTP Skulptur — commerce, stage 2: products.
--
-- A product can optionally reference an existing artwork (products.artwork_id)
-- so a sculpture already in the portfolio can be sold without duplicating its
-- title/description/images — but Product and Artwork stay logically separate
-- tables: a product is a *sellable listing* (price, inventory, SKU), an
-- artwork is a *portfolio entry* (SEO, display_order, series). Prints, books,
-- and merch are products with no artwork_id at all.
--
-- Images follow the exact pattern already used for artworks/exhibitions/posts
-- (a `media` row + an ordered join table), not a new bucket-path convention.

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  short_description text,
  category text not null default 'sculpture'
    check (category in ('sculpture', 'print', 'book', 'merchandise', 'limited_edition', 'other')),
  price numeric(10, 2) not null check (price >= 0),
  currency text not null default 'SEK',
  sku text unique,
  inventory integer not null default 0 check (inventory >= 0),
  active boolean not null default false,
  featured boolean not null default false,
  vendor_id uuid references vendors (id) on delete set null,
  artwork_id uuid references artworks (id) on delete set null,
  primary_image_id uuid references media (id) on delete set null,
  seo_title text,
  seo_description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_active_idx on products (active, display_order);
create index products_vendor_idx on products (vendor_id);
create index products_artwork_idx on products (artwork_id);

create trigger products_set_updated_at before update on products
  for each row execute function set_updated_at();

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  media_id uuid not null references media (id) on delete cascade,
  display_order integer not null default 0,
  unique (product_id, media_id)
);

create index product_images_product_idx on product_images (product_id, display_order);

alter table products enable row level security;
alter table product_images enable row level security;

-- public read: active products only (same shape as artworks/exhibitions/posts)
create policy "public can read active products" on products
  for select using (active = true);
create policy "admin can read all products" on products
  for select using (is_admin());
create policy "admin can manage products" on products
  for insert with check (is_admin());
create policy "admin can update products" on products
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete products" on products
  for delete using (is_admin());
-- Vendors do not get direct table access to products (or anything else
-- commerce-related) via RLS — a vendor-scoped `for select using (vendor_id =
-- current_vendor_id())` policy would still expose every column, including
-- ones a vendor has no reason to see. Every vendor-facing read goes through
-- /api/vendor/* using the service role, which hand-picks columns. See
-- 0011_orders.sql for the same reasoning applied to orders.

create policy "public can read images of active products" on product_images
  for select using (
    exists (select 1 from products p where p.id = product_id and p.active = true)
  );
create policy "admin can read all product_images" on product_images
  for select using (is_admin());
create policy "admin can manage product_images" on product_images
  for insert with check (is_admin());
create policy "admin can update product_images" on product_images
  for update using (is_admin()) with check (is_admin());
create policy "admin can delete product_images" on product_images
  for delete using (is_admin());
