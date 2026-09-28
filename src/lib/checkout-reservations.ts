import type { getSupabaseServerClient } from './supabase-server';
import { getStripeClient } from './stripe';

type AdminClient = ReturnType<typeof getSupabaseServerClient>;

// Releases a still-pending checkout reservation on behalf of the browser
// that created it (identified by clientSessionId — see
// getCheckoutClientSessionId() in lib/cart.ts), restoring the inventory it
// was holding and best-effort expiring its Stripe session. Shared by:
//  - POST /api/checkout/release, called proactively by reconcileCart()
//    whenever a browser that has an in-flight/abandoned checkout attempt
//    reconciles its cart (e.g. landing back on /shop/cart after clicking
//    Back on Stripe's hosted page) — otherwise the cart-reconciliation
//    itself would silently drop the now-"unavailable" item before the
//    customer ever gets a chance to retry.
//  - /api/checkout/session, called just before starting a *new* checkout,
//    as a second safety net for the same scenario.
// No-op (and safe to call) if there's nothing pending for this id.
export async function releaseOwnReservation(admin: AdminClient, clientSessionId: string): Promise<void> {
  const { data: previous } = await admin
    .from('orders')
    .select('id, stripe_checkout_session_id')
    .eq('client_session_id', clientSessionId)
    .eq('payment_status', 'pending')
    .maybeSingle();
  if (!previous) return;

  // Atomic claim — if something else (this same call racing itself, the
  // Stripe expiry webhook, etc.) already released this order, this affects
  // zero rows and nothing below runs.
  const { data: claimed } = await admin
    .from('orders')
    .update({ payment_status: 'expired' })
    .eq('id', previous.id)
    .eq('payment_status', 'pending')
    .select('id')
    .maybeSingle();
  if (!claimed) return;

  const { data: items } = await admin.from('order_items').select('artwork_id, product_id, quantity').eq('order_id', previous.id);
  for (const item of items ?? []) {
    if (item.artwork_id) {
      await admin.rpc('restore_artwork_inventory', { p_artwork_id: item.artwork_id, p_qty: item.quantity });
    } else if (item.product_id) {
      await admin.rpc('restore_product_inventory', { p_product_id: item.product_id, p_qty: item.quantity });
    }
  }
  await admin.from('fulfillment_events').insert({ order_id: previous.id, event_type: 'superseded_by_retry' });

  if (previous.stripe_checkout_session_id) {
    try {
      await getStripeClient().checkout.sessions.expire(previous.stripe_checkout_session_id);
    } catch (err) {
      // Non-fatal: it may already be expired/completed on Stripe's side.
      // Inventory was already released above based on our own DB state,
      // which is authoritative.
      console.warn('[checkout] could not expire superseded Stripe session', err);
    }
  }
}
