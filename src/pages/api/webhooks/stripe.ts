import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { verifyStripeWebhook } from '../../../lib/stripe';
import { getSupabaseServerClient } from '../../../lib/supabase-server';
import { sendEmail } from '../../../lib/resend';
import { renderOrderConfirmedEmail, renderVendorOrderNotificationEmail } from '../../../lib/email-templates';
import { countryMatchesRegion } from '../../../lib/shipping';
import { getSiteUrl } from '../../../lib/site-url';
import type { ShippingRegion } from '../../../types/database';

export const prerender = false;

type AdminClient = ReturnType<typeof getSupabaseServerClient>;

export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  if (!signature || !rawBody) {
    return new Response('Missing signature or body', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await verifyStripeWebhook(rawBody, signature);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const admin = getSupabaseServerClient();

  // Idempotency: this insert succeeding is itself the atomic claim on having
  // handled this event id. A unique-violation means a duplicate delivery —
  // expected (that's how webhooks work) — and should no-op, not reprocess.
  const { error: dedupeError } = await admin.from('stripe_webhook_events').insert({ id: event.id, type: event.type });
  if (dedupeError) {
    if (dedupeError.code === '23505') {
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }
    // Fails open: a transient dedupe-table error shouldn't make Stripe
    // believe the webhook is broken and stop retrying. Each handler below
    // still checks payment_status before writing, which is the guard that
    // actually matters (prevents double-charging effects like inventory).
    console.error('[stripe webhook] dedupe insert failed', dedupeError);
  }

  // See lib/site-url.ts. request.url is this webhook's own receiving
  // origin — whatever host Stripe is currently configured to POST to
  // (workers.dev today; jtpskulptur.com automatically once the Stripe
  // webhook endpoint is repointed there at cutover), never a stale
  // Astro.site value that could send the vendor-notification link below to
  // a domain that isn't live yet.
  const siteUrl = getSiteUrl(request);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === 'paid') {
        await markOrderPaid(session, admin, siteUrl);
      }
      break;
    }
    case 'checkout.session.expired': {
      await releasePendingOrder(event.data.object as Stripe.Checkout.Session, admin);
      break;
    }
    case 'payment_intent.payment_failed': {
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, admin);
      break;
    }
    case 'charge.refunded': {
      await handleRefund(event.data.object as Stripe.Charge, admin);
      break;
    }
    default:
      // Unhandled event types are expected — acknowledge with 200 so Stripe
      // doesn't retry something we intentionally don't act on.
      break;
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};

async function markOrderPaid(session: Stripe.Checkout.Session, admin: AdminClient, siteUrl: string) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single();
  if (!order) return;

  // Idempotency guard: a Stripe retry of this same event is a no-op.
  if (order.payment_status === 'paid') return;

  const shippingDetails = session.collected_information?.shipping_details;
  const customerName = session.customer_details?.name ?? shippingDetails?.name ?? null;
  const shippingAddress = shippingDetails?.address
    ? {
        name: shippingDetails.name ?? '',
        line1: shippingDetails.address.line1 ?? '',
        line2: shippingDetails.address.line2,
        city: shippingDetails.address.city ?? '',
        postal_code: shippingDetails.address.postal_code ?? '',
        country: shippingDetails.address.country ?? '',
      }
    : null;

  // Defense in depth: shipping_address_collection.allowed_countries (set
  // when the Checkout Session was created) already restricts Stripe's own
  // hosted form to the region the customer paid a shipping rate for — this
  // re-checks it server-side rather than trusting that client-side
  // restriction as the only guard. A mismatch here means something is
  // inconsistent (a stale/tampered session, or an edge case in how the
  // address was collected), and the order must not silently proceed to
  // fulfillment — an admin needs to look at it first.
  const addressMatches = order.shipping_region
    ? countryMatchesRegion(shippingAddress?.country, order.shipping_region as ShippingRegion)
    : true;

  await admin
    .from('orders')
    .update({
      payment_status: 'paid',
      fulfillment_status: addressMatches ? 'processing' : 'address_review_required',
      shipping_address_status: addressMatches ? 'ok' : 'review_required',
      paid_at: new Date().toISOString(),
      customer_name: customerName,
      shipping_address: shippingAddress,
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    })
    .eq('id', orderId);

  const { data: items } = await admin.from('order_items').select('*').eq('order_id', orderId);

  // The one server-side place an artwork ever flips available -> sold —
  // gated entirely behind Stripe's own verified webhook, never the browser
  // reaching /success. Inventory was already decremented at checkout-session
  // creation (see try_reserve_artwork_inventory); this just makes the sale
  // final and pulls the piece out of Shop/Portfolio's "available" listing.
  // Reachable only once per order: the payment_status === 'paid' guard above
  // returns early on any Stripe retry of this same event. Done regardless of
  // the address-mismatch check above — payment genuinely succeeded either
  // way, so the piece is genuinely sold; only *fulfillment* (and the vendor
  // notification below) waits on the address being resolved.
  const artworkIds = (items ?? []).map((i) => i.artwork_id).filter((id): id is string => !!id);
  for (const artworkId of artworkIds) {
    await admin.from('artworks').update({ availability: 'sold' }).eq('id', artworkId).eq('availability', 'available');
  }

  await admin.from('fulfillment_events').insert({
    order_id: orderId,
    event_type: addressMatches ? 'payment_confirmed' : 'payment_confirmed_address_mismatch',
    metadata: addressMatches
      ? { stripe_session_id: session.id }
      : {
          stripe_session_id: session.id,
          selected_region: order.shipping_region,
          address_country: shippingAddress?.country ?? null,
        },
  });

  const { subject, html, text } = renderOrderConfirmedEmail(
    {
      order_number: order.order_number,
      total: order.total,
      currency: order.currency,
      shipping: order.shipping,
      shipping_region: order.shipping_region,
    },
    (items ?? []).map((i) => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price }))
  );
  await sendEmail({ to: order.customer_email, subject, html, text }).catch((err) =>
    console.error('[stripe webhook] order confirmation email failed', err)
  );

  // Vendor notification tells a vendor "this is paid, please ship it" — so
  // it must never fire while the shipping address still needs a human to
  // look at it. Withholding it here doesn't lose the notification: once an
  // admin resolves the mismatch (see /admin/orders/[id]), fulfillment can
  // proceed and a vendor notification can be sent from there.
  if (!addressMatches) return;

  // Reachable only from here, after Stripe's own webhook has verified
  // payment AND the shipping address has been confirmed consistent. Never
  // triggered from the success page or any browser-initiated request.
  const vendorIds = [...new Set((items ?? []).map((i) => i.vendor_id).filter((id): id is string => !!id))];
  for (const vendorId of vendorIds) {
    const { data: vendor } = await admin.from('vendors').select('*').eq('id', vendorId).single();
    if (!vendor || !vendor.active || !vendor.notification_email) continue;

    const vendorItems = (items ?? []).filter((i) => i.vendor_id === vendorId);
    const { subject: vSubject, html: vHtml, text: vText } = renderVendorOrderNotificationEmail(
      { order_number: order.order_number, total: order.total, currency: order.currency },
      vendorItems.map((i) => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
      `${siteUrl}/vendor`
    );
    await sendEmail({ to: vendor.notification_email, subject: vSubject, html: vHtml, text: vText }).catch((err) =>
      console.error('[stripe webhook] vendor notification email failed', err)
    );
  }

  if (vendorIds.length > 0) {
    await admin.from('orders').update({ vendor_notified_at: new Date().toISOString() }).eq('id', orderId);
    await admin.from('fulfillment_events').insert({ order_id: orderId, event_type: 'vendor_notified' });
  }
}

/**
 * A `pending` order whose Stripe session expired (customer never completed
 * checkout — bounded to RESERVATION_MINUTES via the session's own
 * expires_at, see checkout/session.ts) needs its reserved inventory back.
 * Distinct status from 'failed' (a genuine declined payment attempt) so an
 * admin can tell the two apart at a glance.
 */
async function releasePendingOrder(session: Stripe.Checkout.Session, admin: AdminClient) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  // Atomically claims the order for release — only a still-pending order
  // has reserved stock to release, and this update is itself the guard: if
  // something else (a concurrent retry-supersession, or this same webhook
  // delivered twice) already claimed it, this affects zero rows and the
  // function safely no-ops instead of restoring inventory a second time.
  const { data: claimed } = await admin
    .from('orders')
    .update({ payment_status: 'expired' })
    .eq('id', orderId)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();
  if (!claimed) return;

  const { data: items } = await admin.from('order_items').select('*').eq('order_id', orderId);
  for (const item of items ?? []) {
    if (item.artwork_id) {
      await admin.rpc('restore_artwork_inventory', { p_artwork_id: item.artwork_id, p_qty: item.quantity });
    } else if (item.product_id) {
      await admin.rpc('restore_product_inventory', { p_product_id: item.product_id, p_qty: item.quantity });
    }
  }

  await admin.from('fulfillment_events').insert({
    order_id: orderId,
    event_type: 'checkout_expired',
    metadata: { stripe_session_id: session.id },
  });
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent, admin: AdminClient) {
  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .maybeSingle();

  if (!order || order.payment_status === 'failed') return;

  await admin.from('orders').update({ payment_status: 'failed' }).eq('id', order.id);
  await admin.from('fulfillment_events').insert({
    order_id: order.id,
    event_type: 'payment_failed',
    metadata: { payment_intent: paymentIntent.id },
  });
}

async function handleRefund(charge: Stripe.Charge, admin: AdminClient) {
  const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const { data: order } = await admin
    .from('orders')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (!order || order.payment_status === 'refunded') return;

  await admin.from('orders').update({ payment_status: 'refunded' }).eq('id', order.id);
  await admin.from('fulfillment_events').insert({
    order_id: order.id,
    event_type: 'refunded',
    metadata: { amount_refunded: charge.amount_refunded },
  });
}
