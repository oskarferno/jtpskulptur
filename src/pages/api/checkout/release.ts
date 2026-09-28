import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabase-server';
import { releaseOwnReservation } from '../../../lib/checkout-reservations';

export const prerender = false;

// Called by reconcileCart() (lib/cart.ts) whenever this browser reconciles
// its cart and has a checkout client-session id on record — most commonly
// right after landing back on /shop/cart, whether via Stripe's cancel_url
// or a plain browser Back button. Without this, cart reconciliation would
// otherwise silently drop the item the moment its reservation zeroed the
// artwork's inventory, before the customer ever gets a chance to retry —
// the cart would just look empty. Always responds 200/ok; there's nothing
// for the client to react to either way, and a missing/invalid id or no
// matching reservation are both simply no-ops.
export const POST: APIRoute = async ({ request }) => {
  let body: { clientSessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const clientSessionId = typeof body.clientSessionId === 'string' && body.clientSessionId.length <= 200 ? body.clientSessionId : null;
  if (clientSessionId) {
    await releaseOwnReservation(getSupabaseServerClient(), clientSessionId);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
