import type { APIRoute } from 'astro';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing shipping rate id.');

  let body: { active?: boolean; price?: number };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) {
    return jsonError('Price must be a non-negative number.');
  }
  if (typeof body.active !== 'boolean') {
    return jsonError('Active must be a boolean.');
  }

  const { error } = await supabase
    .from('shipping_rates')
    .update({ active: body.active, price: body.price })
    .eq('id', id);

  if (error) {
    console.error('[admin shipping] update failed', error);
    return jsonError('Could not save. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
