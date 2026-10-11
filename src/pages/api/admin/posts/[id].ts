import type { APIRoute } from 'astro';
import type { Database } from '../../../../types/database';

export const prerender = false;

type PostUpdate = Database['public']['Tables']['posts']['Update'];

const EDITABLE_FIELDS = [
  'title',
  'slug',
  'excerpt',
  'body',
  'cover_media_id',
  'hero_focal_x',
  'hero_focal_y',
  'content_image_media_id',
  'published',
  'seo_title',
  'seo_description',
] as const satisfies readonly (keyof PostUpdate)[];

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing post id.');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const update: PostUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (update as Record<string, unknown>)[field] = body[field];
    }
  }

  if (typeof update.title === 'string' && update.title.trim().length === 0) {
    return jsonError('Title cannot be empty.');
  }
  if (typeof update.slug === 'string' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(update.slug)) {
    return jsonError('Slug must be lowercase letters, numbers, and hyphens only.');
  }
  for (const field of ['hero_focal_x', 'hero_focal_y'] as const) {
    if (field in update) {
      const value = update[field];
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
        return jsonError(`${field} must be a whole number between 0 and 100.`);
      }
    }
  }
  if ('content_image_media_id' in update && update.content_image_media_id !== null && typeof update.content_image_media_id !== 'string') {
    return jsonError('content_image_media_id must be a media id or null.');
  }

  if (update.published === true) {
    const { data: existing } = await supabase.from('posts').select('published_at').eq('id', id).single();
    if (existing && !existing.published_at) {
      update.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await supabase.from('posts').update(update).eq('id', id).select().single();
  if (error) {
    if (error.code === '23505') return jsonError('That slug is already used by another article.');
    console.error('[admin posts] update failed', error);
    return jsonError('Could not save. Please try again.', 500);
  }

  return new Response(JSON.stringify({ post: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing post id.');

  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) {
    console.error('[admin posts] delete failed', error);
    return jsonError('Could not delete. Please try again.', 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
