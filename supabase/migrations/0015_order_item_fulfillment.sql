-- JTP Skulptur — per-item shipment tracking.
--
-- orders.shipped_at/tracking_number/tracking_url (0011) can't represent a
-- multi-vendor order where vendor A has shipped their item and vendor B
-- hasn't — a single order-level timestamp only works for single-vendor
-- orders. Tracking shipment per order_item lets each vendor mark their own
-- portion independently; the order's overall fulfillment_status is derived
-- from whether every item is shipped, not set directly by any one vendor.

alter table order_items
  add column shipped_at timestamptz,
  add column tracking_number text,
  add column tracking_url text,
  add column shipped_by uuid references profiles (id) on delete set null;

-- Guards the shipping-confirmation email against being sent once per vendor
-- on a multi-vendor order (each vendor shipping their portion would
-- otherwise re-trigger "your order has shipped" once per vendor) — it's
-- sent exactly once, when the order's fulfillment_status first reaches
-- 'shipped' (every item shipped), not on each individual item.
alter table orders add column shipping_email_sent_at timestamptz;

-- Marks the order 'shipped' once every one of its items has shipped_at set,
-- and back to 'processing' if a new item is ever added after that (shouldn't
-- normally happen post-payment, but keeps the derived state honest if it does).
-- Called after any order_items.shipped_at update — see /api/vendor/orders/*/ship
-- and /api/admin/orders/*/ship, both of which call this instead of writing
-- orders.fulfillment_status directly.
create function sync_order_fulfillment_status(p_order_id uuid) returns void as $$
declare
  total_items integer;
  shipped_items integer;
begin
  select count(*), count(shipped_at) into total_items, shipped_items
  from order_items where order_id = p_order_id;

  if total_items > 0 and total_items = shipped_items then
    update orders set fulfillment_status = 'shipped', shipped_at = coalesce(shipped_at, now())
      where id = p_order_id and payment_status = 'paid';
  elsif shipped_items < total_items then
    update orders set fulfillment_status = 'processing'
      where id = p_order_id and payment_status = 'paid' and fulfillment_status = 'shipped';
  end if;
end;
$$ language plpgsql;
