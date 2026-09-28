-- JTP Skulptur — atomic inventory reservation.
--
-- Reserved at checkout-session creation time (not decremented later by the
-- webhook), which is what closes the race where two near-simultaneous
-- checkouts for the last unit could otherwise both pass a plain
-- `inventory > 0` read-then-write check and both go on to pay. The
-- `where inventory >= p_qty` guard makes the decrement itself the
-- availability check — atomic, no separate read step to race against.

create function try_reserve_product_inventory(p_product_id uuid, p_qty integer)
returns boolean as $$
declare
  reserved boolean;
begin
  update products
    set inventory = inventory - p_qty
    where id = p_product_id and inventory >= p_qty
  returning true into reserved;

  return coalesce(reserved, false);
end;
$$ language plpgsql;

create function restore_product_inventory(p_product_id uuid, p_qty integer)
returns void as $$
  update products set inventory = inventory + p_qty where id = p_product_id;
$$ language sql;
