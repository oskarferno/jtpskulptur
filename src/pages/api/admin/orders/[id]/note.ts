import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../../../lib/supabase-server';
import { requireAdmin } from '../../../../../lib/require-admin';

export const prerender = false;

// Deliberately the ONLY field this route can touch. orders has no RLS update
// policy for any role (see 0011's comment) specifically so no endpoint can
// casually grow into also accepting payment_status — this route's own code
// is the only thing enforcing that boundary, so it stays this narrow on
// purpose rather than becoming a general "update order" endpoint.
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const { id } = params;
  if (!id) return new Response(JSON.stringify({ error: 'Missing order id.' }), { status: 400 });

  let body: { internal_note?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), { status: 400 });
  }

  const note = typeof body.internal_note === 'string' ? body.internal_note.slice(0, 5000) : null;

  const admin = getSupabaseServerClient();
  const { error } = await admin.from('orders').update({ internal_note: note }).eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error: 'Could not save note.' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
