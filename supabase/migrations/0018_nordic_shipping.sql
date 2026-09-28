-- JTP Skulptur — dedicated Nordic shipping regions.
--
-- Denmark, Norway, and Finland get their own selectable regions rather than
-- falling under the generic "eu"/"row" buckets, so JTP can price Nordic
-- shipping differently from the rest of Europe/world. Seeded the same way
-- as the original four regions (0010): inactive, price 0 — admin sets real
-- prices and activates via /admin/shipping, nothing here is invented
-- pricing.

alter table shipping_rates drop constraint shipping_rates_region_check;
alter table shipping_rates add constraint shipping_rates_region_check
  check (region in ('sweden', 'denmark', 'norway', 'finland', 'eu', 'us', 'row'));

insert into shipping_rates (region, label, price, active) values
  ('denmark', 'Denmark', 0, false),
  ('norway', 'Norway', 0, false),
  ('finland', 'Finland', 0, false);

-- orders.shipping_region has the same fixed set — every paid order snapshots
-- which region it shipped to, so this needs the same three values.
alter table orders drop constraint orders_shipping_region_check;
alter table orders add constraint orders_shipping_region_check
  check (shipping_region in ('sweden', 'denmark', 'norway', 'finland', 'eu', 'us', 'row'));
