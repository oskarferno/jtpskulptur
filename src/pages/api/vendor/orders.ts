import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabase-server';

export const prerender = false;

/**
 * A vendor's own paid order items — nothing else. Uses the service role,
 * not RLS, and hand-picks exactly these columns: no Stripe IDs, no
 * internal_note, no other vendor's items, no unrelated customer data beyond
 * what's needed to ship (name + shipping address). `locals.vendorId` comes
 * from the middleware's own server-side profile lookup, never from the
 * request — a vendor cannot pass a different vendor_id to see someone
 * else's orders.
 */
export const GET: APIRoute = async ({ locals }) => {
  const vendorId = locals.vendorId;
  if (!vendorId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = getSupabaseServerClient();
  const { data: items, error } = await admin
    .from('order_items')
    .select(
      `id, order_id, product_name, sku, unit_price, quantity, image_path, shipped_at, tracking_number, tracking_url,
       order:order_id (order_number, customer_name, shipping_address, payment_status, created_at, paid_at)`
    )
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: 'Could not load orders.' }), { status: 500 });
  }

  // Only ever show items on orders that are actually paid — a 'pending'
  // order (checkout started but not completed) has no business being
  // visible to a vendor at all.
  const paidItems = (items ?? []).filter((i) => i.order?.payment_status === 'paid');

  return new Response(JSON.stringify({ items: paidItems }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
