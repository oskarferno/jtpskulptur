import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';
import { sendEmail } from '../../../../../lib/resend';
import { renderShippingConfirmedEmail } from '../../../../../lib/email-templates';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  const vendorId = locals.vendorId;
  if (!vendorId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const itemId = params.itemId;
  if (!itemId) {
    return new Response(JSON.stringify({ error: 'Missing item id.' }), { status: 400 });
  }

  let body: { trackingNumber?: unknown; trackingUrl?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — tracking info is optional.
  }
  const trackingNumber = typeof body.trackingNumber === 'string' ? body.trackingNumber.slice(0, 200) : null;
  const trackingUrl = typeof body.trackingUrl === 'string' ? body.trackingUrl.slice(0, 500) : null;

  const admin = getSupabaseServerClient();

  const { data: item } = await admin
    .from('order_items')
    .select('id, order_id, vendor_id, shipped_at, order:order_id (payment_status)')
    .eq('id', itemId)
    .maybeSingle();

  // The ownership check that actually matters: this item must belong to the
  // authenticated vendor. Any mismatch — wrong id, someone else's item,
  // nonexistent item — gets the same 404, so a vendor probing IDs can't
  // distinguish "not yours" from "doesn't exist."
  if (!item || item.vendor_id !== vendorId) {
    return new Response(JSON.stringify({ error: 'Order item not found.' }), { status: 404 });
  }

  if (item.order?.payment_status !== 'paid') {
    return new Response(JSON.stringify({ error: 'This order is not paid.' }), { status: 400 });
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
      shipped_by: locals.user?.id ?? null,
    })
    .eq('id', itemId);

  await admin.rpc('sync_order_fulfillment_status', { p_order_id: item.order_id });

  await admin.from('fulfillment_events').insert({
    order_id: item.order_id,
    event_type: 'item_shipped',
    performed_by: locals.user?.id ?? null,
    metadata: { order_item_id: itemId, tracking_number: trackingNumber },
  });

  // Send the customer's shipping-confirmation email only once, exactly when
  // the whole order (every item, from every vendor) has shipped — see
  // 0015_order_item_fulfillment.sql's comment on shipping_email_sent_at.
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, fulfillment_status, customer_email, total, currency, shipping_email_sent_at')
    .eq('id', item.order_id)
    .single();

  if (order && order.fulfillment_status === 'shipped' && !order.shipping_email_sent_at) {
    const { subject, html, text } = renderShippingConfirmedEmail(
      { order_number: order.order_number, total: order.total, currency: order.currency },
      { trackingNumber, trackingUrl }
    );
    await sendEmail({ to: order.customer_email, subject, html, text })
      .then(() => admin.from('orders').update({ shipping_email_sent_at: new Date().toISOString() }).eq('id', order.id))
      .catch((err) => console.error('[vendor ship] shipping confirmation email failed', err));
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
