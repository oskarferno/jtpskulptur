-- JTP Skulptur — commerce, stage 4: orders.
--
-- Stripe is the source of truth for payment state; this table is the durable
-- record kept in sync via webhook (src/pages/api/webhooks/stripe.ts). JTP has
-- no public customer accounts, so orders key off email, not a user_id.
--
-- order_items snapshots product name/SKU/price/vendor at purchase time —
-- never re-reads the current product row for display, so an order stays
-- correct even if the product is later edited, unpublished, or deleted.

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  customer_email text not null,
  customer_name text,
  subtotal numeric(10, 2) not null default 0,
  shipping numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  currency text not null default 'SEK',
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  fulfillment_status text not null default 'awaiting_payment'
    check (fulfillment_status in ('awaiting_payment', 'processing', 'shipped', 'cancelled')),
  shipping_region text check (shipping_region in ('sweden', 'eu', 'us', 'row')),
  shipping_address jsonb,
  tracking_number text,
  tracking_url text,
  internal_note text,
  paid_at timestamptz,
  shipped_at timestamptz,
  vendor_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_payment_status_idx on orders (payment_status);
create index orders_email_idx on orders (customer_email);
create index orders_created_idx on orders (created_at desc);

create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();

create sequence order_number_seq;

create function generate_order_number() returns text as $$
  select 'JTP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 5, '0');
$$ language sql;

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  vendor_id uuid references vendors (id) on delete set null,
  product_name text not null,
  sku text,
  unit_price numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  image_path text,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on order_items (order_id);
create index order_items_vendor_idx on order_items (vendor_id);

-- Per-event audit trail — who/what changed an order's fulfillment state and
-- when. `performed_by` is null for system-triggered events (the webhook).
create table fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  event_type text not null,
  performed_by uuid references profiles (id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index fulfillment_events_order_idx on fulfillment_events (order_id);

-- Stripe webhook idempotency: inserting the event id is itself the atomic
-- claim on "have I handled this event" — a unique-violation on insert means
-- a duplicate delivery, which is expected (that's how webhooks work) and
-- should just no-op rather than reprocess.
create table stripe_webhook_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

alter table orders enable row level security;
alter table order_items enable row level security;
alter table fulfillment_events enable row level security;
alter table stripe_webhook_events enable row level security;

-- No policy for 'vendor' or public on any of these four tables — same
-- reasoning as products (see 0009): RLS can only restrict rows, and a
-- vendor's data-minimization needs here are column-level (no Stripe IDs, no
-- internal notes, no other vendor's items). Every vendor-facing read/write
-- goes through /api/vendor/* using the service role.
--
-- Orders/order_items get NO update policy for any role, including admin —
-- not even for fulfillment_status. RLS can restrict rows but not columns, so
-- a policy permissive enough to let admin advance
-- processing -> shipped would, by the same grant, let a normal client-side
-- update call also change payment_status directly — exactly the "insecure
-- mark-as-paid button" the task says must not exist. Every write to orders
-- (checkout creation, the Stripe webhook, AND admin fulfillment actions like
-- adding a tracking number) goes through server code using the service role,
-- which can enforce "this endpoint may only touch fulfillment_status/
-- tracking_number/internal_note, never payment_status" in application logic
-- instead of relying on RLS to express that distinction.
create policy "admin can read orders" on orders
  for select using (is_admin());

create policy "admin can read order_items" on order_items
  for select using (is_admin());

create policy "admin can read fulfillment_events" on fulfillment_events
  for select using (is_admin());

-- stripe_webhook_events: no policies at all. Only the webhook handler
-- (service role) ever touches this table; it isn't meant to be human-read.
