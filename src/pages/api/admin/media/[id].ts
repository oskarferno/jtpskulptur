import type { APIRoute } from 'astro';
import type { Database } from '../../../../types/database';

export const prerender = false;

type MediaUpdate = Database['public']['Tables']['media']['Update'];

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing media id.');

  let body: { alt_text?: string | null; caption?: string | null };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const update: MediaUpdate = {};
  if ('alt_text' in body) update.alt_text = body.alt_text || null;
  if ('caption' in body) update.caption = body.caption || null;

  const { data, error } = await supabase.from('media').update(update).eq('id', id).select().single();
  if (error) return jsonError(error.message, 500);

  return new Response(JSON.stringify({ media: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing media id.');

  const { data: media } = await supabase.from('media').select('storage_path, bucket').eq('id', id).single();

  const { error: deleteError } = await supabase.from('media').delete().eq('id', id);
  if (deleteError) return jsonError(deleteError.message, 500);

  if (media) {
    await supabase.storage.from(media.bucket).remove([media.storage_path]);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
