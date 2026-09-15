import type { APIRoute } from 'astro';
import type { Database } from '../../../types/database';

export const prerender = false;

type AboutUpdate = Database['public']['Tables']['about_content']['Update'];

const EDITABLE_FIELDS = [
  'artist_name',
  'portrait_media_id',
  'short_bio',
  'full_bio',
  'artist_statement',
  'cv_media_id',
  'education',
  'awards',
  'collections',
  'press',
] as const satisfies readonly (keyof AboutUpdate)[];

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ request, locals }) => {
  const supabase = locals.supabase!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const update: AboutUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (update as Record<string, unknown>)[field] = body[field];
    }
  }

  const { data, error } = await supabase.from('about_content').update(update).eq('id', true).select().single();
  if (error) return jsonError(error.message, 500);

  return new Response(JSON.stringify({ about: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
