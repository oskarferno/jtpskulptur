import type { APIRoute } from 'astro';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase!;

  let body: { name?: string; slug?: string; price?: number };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const name = (body.name ?? '').trim();
  const slug = (body.slug ?? '').trim();
  const price = Number(body.price);

  if (!name) return jsonError('Name is required.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return jsonError('Slug must be lowercase letters, numbers, and hyphens only.');
  }
  if (!Number.isFinite(price) || price < 0) return jsonError('Price must be a non-negative number.');

  const { data, error } = await supabase
    .from('products')
    .insert({ name, slug, price, active: false })
    .select()
    .single();

  if (error) {
    console.error('[admin products] create failed', error);
    return jsonError('Could not create product. Please try again.', 500);
  }

  return new Response(JSON.stringify({ product: data }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
