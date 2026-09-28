-- JTP Skulptur — commerce, stage 1: vendors.
-- Standalone to JTP. No relation to any other project's Stripe/vendor setup.
--
-- A vendor is a business/person JTP sells on behalf of. Vendor accounts are
-- ordinary profiles rows with role='vendor', linked 1:1 to a vendors row —
-- mirrors the existing admin pattern (profiles.id references auth.users)
-- rather than inventing a second auth system.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin', 'vendor'));

alter table profiles add column vendor_id uuid;

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  notification_email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles add constraint profiles_vendor_id_fkey
  foreign key (vendor_id) references vendors (id) on delete set null;

create trigger vendors_set_updated_at before update on vendors
  for each row execute function set_updated_at();

-- Helper: is the current JWT a vendor with an assigned vendor_id?
create function is_vendor() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'vendor' and vendor_id is not null
  );
$$ language sql stable security definer set search_path = public;

-- Helper: the current vendor's own vendor_id, or null.
create function current_vendor_id() returns uuid as $$
  select vendor_id from profiles where id = auth.uid() and role = 'vendor';
$$ language sql stable security definer set search_path = public;

alter table vendors enable row level security;

-- No public read at all — vendor names/contact emails aren't public storefront
-- data. Admin manages everything; a vendor can read only their own row
-- (matches the existing "admin can read own profile" pattern).
create policy "admin can manage vendors" on vendors
  for all using (is_admin()) with check (is_admin());
create policy "vendor can read own vendor row" on vendors
  for select using (id = current_vendor_id());
