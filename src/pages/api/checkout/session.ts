import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { getSupabaseClient } from '../../../lib/supabase';
import { getSupabaseServerClient } from '../../../lib/supabase-server';
import { getStripeClient } from '../../../lib/stripe';
import { SHIPPING_REGIONS, allowedCountriesFor } from '../../../lib/shipping';
import { releaseOwnReservation } from '../../../lib/checkout-reservations';
import type { ShippingRegion } from '../../../types/database';

export const prerender = false;

const MAX_ITEMS = 50;
const MAX_QTY = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// How long a checkout reservation holds inventory before it's considered
// abandoned. Short enough that a customer who never comes back doesn't lock
// a unique sculpture away for long; a customer who *does* come back (e.g.
// after clicking Back to fix their shipping country) doesn't need to wait
// for this at all — see releaseOwnReservation() in
// lib/checkout-reservations.ts, called below, which releases their own
// prior attempt immediately instead. 30 minutes is also the minimum Stripe
// allows for a Checkout Session's own expires_at.
const RESERVATION_MINUTES = 30;

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

type ItemType = 'artwork' | 'product';
type AdminClient = ReturnType<typeof getSupabaseServerClient>;

interface RequestedItem {
  type: ItemType;
  id: string;
  quantity: number;
}

// Sculptures (artworks) and non-artwork merch (products) are two different
// tables — see migration 0017 — but resolve to the exact same shape here so
// everything downstream (reservation, Stripe line items, order_items) is a
// single code path regardless of which table an item actually came from.
interface ResolvedItem {
  type: ItemType;
  id: string;
  name: string;
  sku: string | null;
  price: number;
  currency: string;
  vendorId: string | null;
  imagePath: string | null;
  inventory: number;
  quantity: number;
}

function restoreInventory(admin: AdminClient, type: ItemType, id: string, quantity: number) {
  return type === 'artwork'
    ? admin.rpc('restore_artwork_inventory', { p_artwork_id: id, p_qty: quantity })
    : admin.rpc('restore_product_inventory', { p_product_id: id, p_qty: quantity });
}

// Atomically claims a still-pending order for release, so two concurrent
// callers (e.g. this sweep and a Stripe checkout.session.expired webhook
// arriving at the same moment) can't both restore the same inventory —
// only whichever update actually flips payment_status away from 'pending'
// proceeds to restore anything.
async function claimAndReleaseOrder(admin: AdminClient, orderId: string, newStatus: 'expired', eventType: string) {
  const { data: claimed } = await admin
    .from('orders')
    .update({ payment_status: newStatus })
    .eq('id', orderId)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();
  if (!claimed) return false;

  const { data: items } = await admin.from('order_items').select('artwork_id, product_id, quantity').eq('order_id', orderId);
  for (const item of items ?? []) {
    if (item.artwork_id) await restoreInventory(admin, 'artwork', item.artwork_id, item.quantity);
    else if (item.product_id) await restoreInventory(admin, 'product', item.product_id, item.quantity);
  }
  await admin.from('fulfillment_events').insert({ order_id: orderId, event_type: eventType });
  return true;
}

// If an item looks out of stock, check whether that's actually a genuinely
// stale reservation (past its own expiry) rather than real demand — and if
// so, release it and let the caller re-check. Covers the case where
// Stripe's own expiry webhook hasn't arrived yet (it can be delayed) but a
// different customer is now trying to buy the same item.
async function sweepExpiredReservationsFor(admin: AdminClient, type: ItemType, id: string) {
  // Two simple queries rather than a nested embedded-resource filter, so
  // the behavior here is easy to reason about and verify directly: first
  // find which *orders* are stale, then check locally which (if any) of
  // this specific artwork/product's blocking order_items belong to one of
  // them. Pending orders are a small table in practice, so this is cheap.
  const { data: staleOrders } = await admin
    .from('orders')
    .select('id')
    .eq('payment_status', 'pending')
    .lt('reservation_expires_at', new Date().toISOString());
  if (!staleOrders || staleOrders.length === 0) return;

  const column = type === 'artwork' ? 'artwork_id' : 'product_id';
  const { data: blocking } = await admin
    .from('order_items')
    .select('order_id')
    .eq(column, id)
    .in('order_id', staleOrders.map((o) => o.id));

  for (const row of blocking ?? []) {
    await claimAndReleaseOrder(admin, row.order_id, 'expired', 'reservation_swept');
  }
}

// Security audit finding M-2: nothing previously bounded how many times a
// checkout session could be created (and released, and re-created) for the
// same artwork — since releaseOwnReservation() + an immediate new
// reservation is exactly the legitimate "fix my shipping country after
// Stripe's Back button" flow this app deliberately supports, an
// unauthenticated script could exploit that same mechanism to hold a unique
// (inventory=1) sculpture's reservation open indefinitely, roughly every
// <30 minutes forever, without ever paying — permanently blocking real
// buyers. This doesn't attempt to distinguish "legitimate retry" from
// "abuse" per attempt (that's what Cloudflare Rate Limiting Rules on this
// endpoint would do, external to this app — recommended as a complementary
// fix); it bounds the worst case instead: once a single artwork has
// accumulated an unusually high number of reservation attempts (from
// anyone, regardless of client_session_id, which isn't trustworthy on its
// own) within a rolling day, further attempts wait until that count ages
// out. A real one-of-a-kind piece being checkout-attempted 30+ times in a
// day, pre-launch, is itself already anomalous — this threshold is
// deliberately generous so it should never affect genuine shopping/retry
// behavior.
const MAX_ARTWORK_RESERVATION_ATTEMPTS_PER_DAY = 30;

async function countRecentReservationAttempts(admin: AdminClient, artworkId: string): Promise<number> {
  // Two simple queries, matching sweepExpiredReservationsFor's own reasoning
  // above — easier to verify correct than a nested embedded-resource filter.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentOrders } = await admin.from('orders').select('id').gte('created_at', since);
  if (!recentOrders || recentOrders.length === 0) return 0;

  const { count } = await admin
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('artwork_id', artworkId)
    .in('order_id', recentOrders.map((o) => o.id));
  return count ?? 0;
}

export const POST: APIRoute = async ({ request }) => {
  let body: { items?: unknown; shippingRegion?: unknown; email?: unknown; clientSessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid request body.');
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(email)) return badRequest('A valid email is required.');

  if (typeof body.shippingRegion !== 'string' || !SHIPPING_REGIONS.includes(body.shippingRegion as ShippingRegion)) {
    return badRequest('Invalid shipping region.');
  }
  const shippingRegion: ShippingRegion = body.shippingRegion as ShippingRegion;

  const clientSessionId = typeof body.clientSessionId === 'string' && body.clientSessionId.length <= 200 ? body.clientSessionId : null;

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
    return badRequest('Cart is empty or invalid.');
  }

  const requested: RequestedItem[] = [];
  for (const raw of body.items) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      ((raw as any).type !== 'artwork' && (raw as any).type !== 'product') ||
      typeof (raw as any).id !== 'string' ||
      !Number.isInteger((raw as any).quantity) ||
      (raw as any).quantity < 1 ||
      (raw as any).quantity > MAX_QTY
    ) {
      return badRequest('Invalid cart item.');
    }
    requested.push({ type: (raw as any).type, id: (raw as any).id, quantity: (raw as any).quantity });
  }

  const supabase = getSupabaseClient();
  const admin = getSupabaseServerClient();

  // Release the customer's own earlier still-pending reservation from this
  // same browser, if any, before attempting a new one. Safe to do even if
  // there isn't one (no-op) — and normally there already isn't, since
  // reconcileCart() (lib/cart.ts) already triggers this same release as
  // soon as the browser lands back on the Cart page, before the customer
  // even gets to clicking Checkout again. This is a second safety net.
  if (clientSessionId) {
    await releaseOwnReservation(admin, clientSessionId);
  }

  // Shipping rate: read via the anon client, so an inactive/unconfigured
  // region is rejected the same way RLS rejects it everywhere else — the
  // frontend's region list is not what's authoritative here.
  const { data: shippingRate } = await supabase
    .from('shipping_rates')
    .select('region, price, currency')
    .eq('region', shippingRegion)
    .eq('active', true)
    .maybeSingle();

  if (!shippingRate) {
    return badRequest('Shipping to this destination is not currently available.');
  }

  const artworkIds = requested.filter((r) => r.type === 'artwork').map((r) => r.id);
  const productIds = requested.filter((r) => r.type === 'product').map((r) => r.id);

  // Prices, currency, availability, and vendor all come from these queries —
  // never from the request body. An id that's no longer purchasable simply
  // isn't returned (RLS + the availability/active filters), which the
  // resolved-count check below catches.
  const [{ data: artworks }, { data: products }] = await Promise.all([
    artworkIds.length > 0
      ? supabase
          .from('artworks')
          .select('id, title, sku, price, currency, inventory, vendor_id, primary_media:primary_image_id (storage_path)')
          .in('id', artworkIds)
          .eq('published', true)
          .eq('availability', 'available')
      : Promise.resolve({ data: [] as any[] }),
    productIds.length > 0
      ? supabase
          .from('products')
          .select('id, name, sku, price, currency, inventory, vendor_id, primary_image:primary_image_id (storage_path)')
          .in('id', productIds)
          .eq('active', true)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const resolvedById = new Map<string, ResolvedItem>();
  for (const a of artworks ?? []) {
    if (a.price === null) continue; // shouldn't happen for availability='available', but never trust it implicitly
    resolvedById.set(`artwork:${a.id}`, {
      type: 'artwork',
      id: a.id,
      name: a.title,
      sku: a.sku,
      price: a.price,
      currency: a.currency,
      vendorId: a.vendor_id,
      imagePath: a.primary_media?.storage_path ?? null,
      inventory: a.inventory,
      quantity: 0,
    });
  }
  for (const p of products ?? []) {
    resolvedById.set(`product:${p.id}`, {
      type: 'product',
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      currency: p.currency,
      vendorId: p.vendor_id,
      imagePath: p.primary_image?.storage_path ?? null,
      inventory: p.inventory,
      quantity: 0,
    });
  }

  const lineItems: ResolvedItem[] = [];
  for (const r of requested) {
    const resolved = resolvedById.get(`${r.type}:${r.id}`);
    if (!resolved) return badRequest('One or more items are no longer available.');
    lineItems.push({ ...resolved, quantity: r.quantity });
  }

  const currency = lineItems[0]!.currency;
  if (lineItems.some((i) => i.currency !== currency) || shippingRate.currency !== currency) {
    // Not expected in practice (single-currency catalog), but a hard stop
    // rather than silently summing mismatched currencies if it ever happens.
    return badRequest('Currency mismatch — please contact us.');
  }

  for (const item of lineItems) {
    if (item.inventory < item.quantity) {
      // Before giving up, check whether this is actually a stale reservation
      // (e.g. Stripe's expiry webhook hasn't arrived yet) rather than real
      // demand, and sweep it if so.
      await sweepExpiredReservationsFor(admin, item.type, item.id);
      const { data: fresh } = await supabase
        .from(item.type === 'artwork' ? 'artworks' : 'products')
        .select('inventory')
        .eq('id', item.id)
        .single();
      if (!fresh || fresh.inventory < item.quantity) {
        return badRequest(`"${item.name}" doesn't have enough stock available.`);
      }
      item.inventory = fresh.inventory;
    }
  }

  // See countRecentReservationAttempts' own comment (M-2) — bounds how many
  // times any one artwork can be checkout-attempted per day, so repeatedly
  // releasing-then-re-reserving the same unique piece can't hold it hostage
  // indefinitely. Checked here (after stock/currency validation, before
  // actually reserving) so a legitimately out-of-stock or invalid cart never
  // reaches this and a genuine retry after fixing shipping still succeeds
  // right up to the threshold.
  for (const item of lineItems) {
    if (item.type !== 'artwork') continue;
    const attempts = await countRecentReservationAttempts(admin, item.id);
    if (attempts >= MAX_ARTWORK_RESERVATION_ATTEMPTS_PER_DAY) {
      console.error(`[checkout] artwork ${item.id} hit the daily reservation-attempt cap (${attempts})`);
      return badRequest(`"${item.name}" has had unusually high checkout activity — please contact us to purchase this piece.`);
    }
  }

  // Reserve inventory atomically before creating anything else — see
  // 0014_inventory_functions.sql / 0017_portfolio_commerce.sql. This is what
  // closes the race for a unique sculpture: two near-simultaneous checkouts
  // for the same one-of-a-kind piece can't both pass this atomic decrement,
  // so only one can ever reach Stripe. Rolled back below if anything after
  // this point fails, so a failed checkout never leaves stock stuck reserved.
  const reserved: { type: ItemType; id: string; quantity: number }[] = [];

  for (const item of lineItems) {
    const { data: ok } =
      item.type === 'artwork'
        ? await admin.rpc('try_reserve_artwork_inventory', { p_artwork_id: item.id, p_qty: item.quantity })
        : await admin.rpc('try_reserve_product_inventory', { p_product_id: item.id, p_qty: item.quantity });
    if (!ok) {
      for (const r of reserved) await restoreInventory(admin, r.type, r.id, r.quantity);
      return badRequest(`"${item.name}" was just purchased by someone else — please refresh your cart.`);
    }
    reserved.push({ type: item.type, id: item.id, quantity: item.quantity });
  }

  const rollbackReservations = async () => {
    for (const r of reserved) await restoreInventory(admin, r.type, r.id, r.quantity);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + shippingRate.price;

  const { data: orderNumberResult } = await admin.rpc('generate_order_number');
  const orderNumber = orderNumberResult;
  if (!orderNumber) {
    await rollbackReservations();
    return new Response(JSON.stringify({ error: 'Could not start checkout. Please try again.' }), { status: 500 });
  }

  const reservationExpiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_email: email,
      subtotal,
      shipping: shippingRate.price,
      total,
      currency,
      shipping_region: shippingRegion,
      payment_status: 'pending',
      fulfillment_status: 'awaiting_payment',
      reservation_expires_at: reservationExpiresAt.toISOString(),
      client_session_id: clientSessionId,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    await rollbackReservations();
    return new Response(JSON.stringify({ error: 'Could not start checkout. Please try again.' }), { status: 500 });
  }

  const { error: itemsError } = await admin.from('order_items').insert(
    lineItems.map((item) => ({
      order_id: order.id,
      artwork_id: item.type === 'artwork' ? item.id : null,
      product_id: item.type === 'product' ? item.id : null,
      vendor_id: item.vendorId,
      product_name: item.name,
      sku: item.sku,
      unit_price: item.price,
      quantity: item.quantity,
      image_path: item.imagePath,
    }))
  );

  if (itemsError) {
    await rollbackReservations();
    await admin.from('orders').delete().eq('id', order.id);
    return new Response(JSON.stringify({ error: 'Could not start checkout. Please try again.' }), { status: 500 });
  }

  // Deliberately the request's own origin, not lib/site-url.ts's
  // getSiteUrl() (used everywhere else — canonical tags, sitemap,
  // transactional emails) — confirmed live that using Astro.site sent a
  // real test customer's browser to a 404 on jtpskulptur.com (not live yet)
  // instead of back to the workers.dev preview they actually checked out
  // from. getSiteUrl() would reintroduce the same risk the moment
  // PUBLIC_SITE_URL is set, since the browser is already sitting on
  // whatever host it started checkout from — sending it to a brand-new
  // host it's never resolved before, at the exact moment payment just
  // succeeded, is the worst possible place for a DNS/propagation surprise.
  // This way success/cancel redirects always land wherever the request
  // actually came from, in every environment, with no code change needed
  // at cutover and no dependency on PUBLIC_SITE_URL being set correctly.
  const siteUrl = new URL(request.url).origin;

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      // Restricts Stripe's own hosted checkout to only the countries valid
      // for the region the customer already paid a shipping price for —
      // prevents someone from selecting "Sweden" pricing and then entering
      // a US shipping address during the Stripe-hosted step. The webhook
      // double-checks this server-side too (see markOrderPaid in
      // webhooks/stripe.ts) rather than trusting Stripe's UI restriction
      // alone.
      shipping_address_collection: {
        allowed_countries: allowedCountriesFor(shippingRegion) as Array<
          Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry
        >,
      },
      // Bounds how long this reservation can hold inventory hostage if the
      // customer never completes or returns — see RESERVATION_MINUTES.
      expires_at: Math.floor(reservationExpiresAt.getTime() / 1000),
      line_items: [
        ...lineItems.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(item.price * 100),
            product_data: { name: item.name },
          },
        })),
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(shippingRate.price * 100),
            product_data: { name: `Shipping — ${shippingRegion.toUpperCase()}` },
          },
        },
      ],
      metadata: { order_id: order.id },
      success_url: `${siteUrl}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/shop/cart?cancelled=1`,
    });

    await admin.from('orders').update({ stripe_checkout_session_id: session.id }).eq('id', order.id);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    await rollbackReservations();
    await admin.from('order_items').delete().eq('order_id', order.id);
    await admin.from('orders').delete().eq('id', order.id);
    console.error('[checkout] Stripe session creation failed', err);
    return new Response(JSON.stringify({ error: 'Could not start checkout. Please try again.' }), { status: 500 });
  }
};
