-- JTP Skulptur — Portfolio as the single source of truth for sculptures.
--
-- Previously, selling a sculpture meant creating it in `artworks`, then
-- creating a *second* record in `products`, then linking the two via
-- `products.artwork_id` — two records to keep in sync for one physical
-- object. This migration moves commerce fields onto `artworks` directly, so
-- there is exactly one record per sculpture. `products` stays in the schema
-- for a possible future non-artwork catalog (books, prints, merchandise)
-- but is no longer used for sculptures at all — its `artwork_id` link is
-- removed.
--
-- No real data exists yet (0 products, 0 orders, 0 order_items at the time
-- of writing) but every step here is written as a safe, data-preserving
-- migration regardless, per the standing rule against blind destructive
-- migrations.

alter table artworks
  add column availability text not null default 'not_for_sale'
    check (availability in ('available', 'sold', 'not_for_sale')),
  add column price numeric(10, 2),
  add column currency text not null default 'SEK',
  add column inventory integer not null default 1 check (inventory >= 0),
  add column sku text unique,
  add column vendor_id uuid references vendors (id) on delete set null;

create index artworks_availability_idx on artworks (availability);
create index artworks_vendor_idx on artworks (vendor_id);

-- Carry over commerce data from any artwork-linked product before that link
-- is removed. A product that was active with stock reads as available; one
-- that was active with none reads as sold; an inactive/unpublished listing
-- reads as not-for-sale — same mapping the Portfolio badge already used.
update artworks a
set
  availability = case
    when p.active and p.inventory > 0 then 'available'
    when p.active then 'sold'
    else 'not_for_sale'
  end,
  price = p.price,
  currency = p.currency,
  inventory = p.inventory,
  sku = p.sku,
  vendor_id = p.vendor_id
from products p
where p.artwork_id = a.id;

-- order_items can now snapshot either a sculpture (artwork_id) or a
-- non-artwork product (product_id) — never both, never neither. Carry
-- forward the artwork link for any historical order that was placed
-- against an artwork-linked product, before that link disappears.
alter table order_items add column artwork_id uuid references artworks (id) on delete set null;

update order_items oi
set artwork_id = p.artwork_id
from products p
where oi.product_id = p.id and p.artwork_id is not null;

alter table order_items
  add constraint order_items_exactly_one_item
    check ((artwork_id is not null) <> (product_id is not null));

create index order_items_artwork_idx on order_items (artwork_id);

-- Sculptures no longer live in `products` at all — remove the now-obsolete
-- rows (their commerce data was already carried onto `artworks` above) and
-- the column itself. `products` remains for a possible future non-artwork
-- catalog (merchandise, prints, books), untouched otherwise.
delete from products where artwork_id is not null;
drop index if exists products_artwork_idx;
alter table products drop column artwork_id;

-- Atomic inventory reservation for artworks, mirroring
-- try_reserve_product_inventory (0014) exactly: the `where` clause is the
-- availability check AND the decrement in one atomic statement, which is
-- what prevents two near-simultaneous checkouts for the same unique piece
-- from both succeeding. Also requires availability = 'available' as a
-- defense-in-depth guard — an artwork already sold or marked not-for-sale
-- can never be reserved even if its inventory count were somehow stale.
create function try_reserve_artwork_inventory(p_artwork_id uuid, p_qty integer)
returns boolean as $$
declare
  reserved boolean;
begin
  update artworks
    set inventory = inventory - p_qty
    where id = p_artwork_id and inventory >= p_qty and availability = 'available'
  returning true into reserved;

  return coalesce(reserved, false);
end;
$$ language plpgsql;

create function restore_artwork_inventory(p_artwork_id uuid, p_qty integer)
returns void as $$
  update artworks set inventory = inventory + p_qty where id = p_artwork_id;
$$ language sql;
