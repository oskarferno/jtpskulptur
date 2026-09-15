-- JTP Skulptur — initial schema
-- Standalone Supabase project for jtp-skulptur. No relation to any other project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per admin user, linked 1:1 to auth.users
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- media: reusable asset library backing Supabase Storage objects
-- ---------------------------------------------------------------------------
create table media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  alt_text text,
  caption text,
  width integer,
  height integer,
  mime_type text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories: optional artwork grouping/series
-- ---------------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- artworks: portfolio pieces
-- ---------------------------------------------------------------------------
create table artworks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  year smallint,
  description text,
  material text,
  dimensions text,
  category_id uuid references categories (id) on delete set null,
  series text,
  primary_image_id uuid references media (id) on delete set null,
  display_order integer not null default 0,
  featured boolean not null default false,
  published boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index artworks_published_idx on artworks (published, display_order);
create index artworks_category_idx on artworks (category_id);

-- ---------------------------------------------------------------------------
-- artwork_images: ordered gallery images per artwork
-- ---------------------------------------------------------------------------
create table artwork_images (
  id uuid primary key default gen_random_uuid(),
  artwork_id uuid not null references artworks (id) on delete cascade,
  media_id uuid not null references media (id) on delete cascade,
  caption text,
  display_order integer not null default 0,
  unique (artwork_id, media_id)
);

create index artwork_images_artwork_idx on artwork_images (artwork_id, display_order);

-- ---------------------------------------------------------------------------
-- exhibitions
-- ---------------------------------------------------------------------------
create table exhibitions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue text,
  city text,
  country text,
  start_date date,
  end_date date,
  description text,
  url text,
  exhibition_type text,
  published boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index exhibitions_published_idx on exhibitions (published, start_date desc);

create table exhibition_images (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references exhibitions (id) on delete cascade,
  media_id uuid not null references media (id) on delete cascade,
  display_order integer not null default 0,
  unique (exhibition_id, media_id)
);

-- ---------------------------------------------------------------------------
-- posts: news / journal
-- ---------------------------------------------------------------------------
create table posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  body text,
  cover_media_id uuid references media (id) on delete set null,
  published boolean not null default false,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_published_idx on posts (published, published_at desc);

create table post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts (id) on delete cascade,
  media_id uuid not null references media (id) on delete cascade,
  display_order integer not null default 0,
  unique (post_id, media_id)
);

-- ---------------------------------------------------------------------------
-- social_links
-- ---------------------------------------------------------------------------
create table social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  label text not null,
  url text not null,
  icon text,
  display_order integer not null default 0,
  published boolean not null default true
);

-- ---------------------------------------------------------------------------
-- site_settings: singleton row for global/contact/SEO defaults
-- ---------------------------------------------------------------------------
create table site_settings (
  id boolean primary key default true check (id),
  site_title text not null default 'jtp.skulptur',
  tagline text,
  contact_email text,
  phone text,
  studio_location text,
  contact_intro text,
  contact_form_enabled boolean not null default true,
  seo_default_title text,
  seo_default_description text,
  og_image_media_id uuid references media (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into site_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- about_content: singleton row for the About page
-- ---------------------------------------------------------------------------
create table about_content (
  id boolean primary key default true check (id),
  artist_name text,
  portrait_media_id uuid references media (id) on delete set null,
  short_bio text,
  full_bio text,
  artist_statement text,
  cv_media_id uuid references media (id) on delete set null,
  education jsonb not null default '[]'::jsonb,
  awards jsonb not null default '[]'::jsonb,
  collections jsonb not null default '[]'::jsonb,
  press jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

insert into about_content (id) values (true);

-- ---------------------------------------------------------------------------
-- contact_messages: submissions from the public contact form
-- ---------------------------------------------------------------------------
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index contact_messages_created_idx on contact_messages (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger artworks_set_updated_at before update on artworks
  for each row execute function set_updated_at();
create trigger posts_set_updated_at before update on posts
  for each row execute function set_updated_at();
create trigger site_settings_set_updated_at before update on site_settings
  for each row execute function set_updated_at();
create trigger about_content_set_updated_at before update on about_content
  for each row execute function set_updated_at();
