-- JTP Skulptur — commerce, stage 3: shipping rates.
--
-- Admin-configurable per-region flat rates, not invented/hardcoded pricing.
-- Starting with the four regions the task specifies; if JTP ever decides to
-- sell Sweden-only, that's just deactivating the other three rows — no code
-- change, since checkout looks up whichever regions are active.

create table shipping_rates (
  id uuid primary key default gen_random_uuid(),
  region text not null unique check (region in ('sweden', 'eu', 'us', 'row')),
  label text not null,
  price numeric(10, 2) not null check (price >= 0),
  currency text not null default 'SEK',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shipping_rates_set_updated_at before update on shipping_rates
  for each row execute function set_updated_at();

-- Seeded inactive with placeholder 0 prices — admin must set real prices and
-- activate the regions JTP actually wants to ship to before launch. Nothing
-- here is invented pricing; it's just row scaffolding.
insert into shipping_rates (region, label, price, active) values
  ('sweden', 'Sweden', 0, false),
  ('eu', 'European Union', 0, false),
  ('us', 'United States', 0, false),
  ('row', 'Rest of world', 0, false);

alter table shipping_rates enable row level security;

-- Public read of active rates only — needed client-side to show shipping
-- cost before checkout, and server-side to validate the destination.
create policy "public can read active shipping_rates" on shipping_rates
  for select using (active = true);
create policy "admin can read all shipping_rates" on shipping_rates
  for select using (is_admin());
create policy "admin can update shipping_rates" on shipping_rates
  for update using (is_admin()) with check (is_admin());
