import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/require-admin';
import { sendEmail } from '../../../../../lib/resend';
import { renderShippingConfirmedEmail } from '../../../../../lib/email-templates';

export const prerender = false;

// Same pattern as /api/vendor/orders/[itemId]/ship.ts, for admin — marks one
// order_item shipped (never touches payment_status; see note.ts's comment).
// Unlike the vendor route, no vendor_id ownership check is needed here since
// admin can ship any item on any order — the requireAdmin() check above is
// the actual boundary.
export const POST: APIRoute = async ({ params, request, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const orderId = params.id;
  if (!orderId) return new Response(JSON.stringify({ error: 'Missing order id.' }), { status: 400 });

  let body: { itemId?: unknown; trackingNumber?: unknown; trackingUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 });
  }

  const itemId = typeof body.itemId === 'string' ? body.itemId : null;
  if (!itemId) return new Response(JSON.stringify({ error: 'Missing item id.' }), { status: 400 });

  const trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.slice(0, 200) : null;
  const trackingUrl = typeof body.trackingUrl === 'string' ? body.trackingUrl.slice(0, 500) : null;

  const admin = getSupabaseServerClient();

  const { data: item } = await admin
    .from('order_items')
    .select('id, order_id, shipped_at')
    .eq('id', itemId)
    .eq('order_id', orderId)
    .maybeSingle();

  if (!item) {
    return new Response(JSON.stringify({ error: 'Order item not found.' }), { status: 404 });
  }
  if (item.shipped_at) {
    return new Response(JSON.stringify({ error: 'Already marked shipped.' }), { status: 400 });
  }

  await admin
    .from('order_items')
    .update({
      shipped_at: new Date().toISOString(),
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      shipped_by: locals.user!.id,
    })
    .eq('id', itemId);

  await admin.rpc('sync_order_fulfillment_status', { p_order_id: orderId });

  await admin.from('fulfillment_events').insert({
    order_id: orderId,
    event_type: 'item_shipped',
    performed_by: locals.user!.id,
    metadata: { order_item_id: itemId, tracking_number: trackingNumber },
  });

  // Same once-only guard as the vendor route — see its comment.
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, fulfillment_status, customer_email, total, currency, shipping_email_sent_at')
    .eq('id', orderId)
    .single();

  if (order && order.fulfillment_status === 'shipped' && !order.shipping_email_sent_at) {
    const { subject, html, text } = renderShippingConfirmedEmail(
      { order_number: order.order_number, total: order.total, currency: order.currency },
      { trackingNumber, trackingUrl }
    );
    await sendEmail({ to: order.customer_email, subject, html, text })
      .then(() => admin.from('orders').update({ shipping_email_sent_at: new Date().toISOString() }).eq('id', order.id))
      .catch((err) => console.error('[admin ship-item] shipping confirmation email failed', err));
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
