import type { APIRoute } from 'astro';

import { nextArtworkPosition } from '../../../../lib/artwork-order';

export const prerender = false;

// New artworks are JTP's own work, so they default to the in-house vendor —
// that's what makes an order for them send the "please ship this" email to
// its notification address. Looked up by name so no id is hard-coded; if the
// vendor is renamed, removed or inactive this quietly yields null (the
// previous behaviour) and a vendor can still be picked on the edit page.
const DEFAULT_VENDOR_NAME = 'JTP Skulptur';

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase!;

  let body: { title?: string; slug?: string; primary_image_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const title = (body.title ?? '').trim();
  const slug = (body.slug ?? '').trim();

  if (!title) return jsonError('Title is required.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return jsonError('Slug must be lowercase letters, numbers, and hyphens only.');
  }
  if (body.primary_image_id !== undefined && body.primary_image_id !== null && typeof body.primary_image_id !== 'string') {
    return jsonError('primary_image_id must be a media id or null.');
  }

  const { data: defaultVendor } = await supabase
    .from('vendors')
    .select('id')
    .eq('name', DEFAULT_VENDOR_NAME)
    .eq('active', true)
    .maybeSingle();

  const { data, error } = await supabase
    .from('artworks')
    .insert({
      title,
      slug,
      published: false,
      vendor_id: defaultVendor?.id ?? null,
      primary_image_id: body.primary_image_id ?? null,
      // Last place, not the column default of 0 (which would mean first).
      display_order: await nextArtworkPosition(supabase, 'display_order'),
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return jsonError('That slug is already used by another artwork.');
    console.error('[admin artworks] create failed', error);
    return jsonError('Could not create artwork. Please try again.', 500);
  }

  return new Response(JSON.stringify({ artwork: data }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
