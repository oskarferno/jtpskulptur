-- JTP Skulptur — safe checkout reservations + shipping address verification
--
-- Fixes a real bug: inventory was permanently decremented the instant a
-- Stripe Checkout Session was created (try_reserve_*_inventory in
-- 0014_inventory_functions.sql), and the ONLY release path was Stripe's own
-- checkout.session.expired webhook — which by default doesn't fire for 24
-- hours, since session.ts never set an explicit expiry. A customer who
-- clicked Back to fix their shipping country found the item "sold out" for
-- up to a full day. The atomic reservation itself (`where inventory >=
-- p_qty`) is correct and stays as-is — it's what prevents overselling a
-- unique sculpture between two concurrent checkouts — only the release path
-- needed fixing.

-- Distinct from 'failed' (a genuine declined/failed payment attempt) so an
-- admin can tell "customer's card was declined" apart from "customer just
-- never finished checking out" at a glance, and distinct from 'pending' so
-- a superseded/expired reservation can never be double-released.
alter table orders drop constraint orders_payment_status_check;
alter table orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'expired'));

-- Mirrors the short expires_at now passed to Stripe when creating the
-- Checkout Session, so the backend can recognize a stale reservation and
-- sweep it immediately when something else needs that stock — rather than
-- only ever finding out once Stripe's own (possibly delayed) webhook
-- arrives.
alter table orders add column reservation_expires_at timestamptz;

-- A private, unguessable id the browser generates once and persists
-- alongside its cart (src/lib/cart.ts) — lets a *new* checkout attempt from
-- the same browser recognize and immediately supersede its own earlier
-- still-pending reservation (e.g. after clicking Back to fix the shipping
-- country), without waiting for expiry, and without letting a different
-- customer supersede someone else's active reservation (they'd need this
-- exact value, which never leaves the original browser).
alter table orders add column client_session_id text;
create index orders_client_session_idx on orders (client_session_id) where client_session_id is not null;

-- Set independently of payment_status: a *paid* order can still need a
-- human to check it before it's actually ready to ship, if the shipping
-- region the customer paid for doesn't match the country Stripe returns as
-- the actual delivery address. Only ever set by the webhook comparing the
-- two — never guessed at or silently corrected.
alter table orders add column shipping_address_status text not null default 'ok'
  check (shipping_address_status in ('ok', 'review_required'));

-- A paid order with a mismatched shipping address must not silently
-- proceed into normal fulfillment (which would notify vendors to ship it).
alter table orders drop constraint orders_fulfillment_status_check;
alter table orders add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('awaiting_payment', 'processing', 'shipped', 'cancelled', 'address_review_required'));
