import type { APIRoute } from 'astro';
import type { Database } from '../../../../types/database';

export const prerender = false;

type ArtworkUpdate = Database['public']['Tables']['artworks']['Update'];

const EDITABLE_FIELDS = [
  'title',
  'slug',
  'year',
  'description',
  'material',
  'dimensions',
  'series',
  'category_id',
  'published',
  'featured',
  'display_order',
  'seo_title',
  'seo_description',
] as const satisfies readonly (keyof ArtworkUpdate)[];

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing artwork id.');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const update: ArtworkUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (update as Record<string, unknown>)[field] = body[field];
    }
  }

  if (typeof update.title === 'string' && update.title.trim().length === 0) {
    return jsonError('Title cannot be empty.');
  }
  if (typeof update.slug === 'string') {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(update.slug)) {
      return jsonError('Slug must be lowercase letters, numbers, and hyphens only.');
    }
  }

  const { data, error } = await supabase.from('artworks').update(update).eq('id', id).select().single();

  if (error) {
    return jsonError(error.message, 500);
  }

  return new Response(JSON.stringify({ artwork: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing artwork id.');

  const { error } = await supabase.from('artworks').delete().eq('id', id);

  if (error) {
    return jsonError(error.message, 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
