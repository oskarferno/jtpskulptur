import type { APIRoute } from 'astro';
import type { Database } from '../../../../types/database';

export const prerender = false;

type ProductUpdate = Database['public']['Tables']['products']['Update'];

const EDITABLE_FIELDS = [
  'name',
  'slug',
  'description',
  'short_description',
  'category',
  'price',
  'currency',
  'sku',
  'inventory',
  'active',
  'featured',
  'vendor_id',
  'primary_image_id',
  'display_order',
  'seo_title',
  'seo_description',
] as const satisfies readonly (keyof ProductUpdate)[];

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing product id.');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const update: ProductUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (update as Record<string, unknown>)[field] = body[field];
    }
  }

  if (typeof update.name === 'string' && update.name.trim().length === 0) {
    return jsonError('Name cannot be empty.');
  }
  if (typeof update.slug === 'string' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(update.slug)) {
    return jsonError('Slug must be lowercase letters, numbers, and hyphens only.');
  }
  if (typeof update.price === 'number' && (!Number.isFinite(update.price) || update.price < 0)) {
    return jsonError('Price must be a non-negative number.');
  }
  if (typeof update.inventory === 'number' && (!Number.isInteger(update.inventory) || update.inventory < 0)) {
    return jsonError('Inventory must be a non-negative whole number.');
  }

  const { data, error } = await supabase.from('products').update(update).eq('id', id).select().single();

  if (error) {
    console.error('[admin products] update failed', error);
    return jsonError('Could not save. Please try again.', 500);
  }

  return new Response(JSON.stringify({ product: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing product id.');

  const { error } = await supabase.from('products').delete().eq('id', id);

  if (error) {
    console.error('[admin products] delete failed', error);
    return jsonError('Could not delete. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
