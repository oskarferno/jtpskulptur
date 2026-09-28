import type { APIRoute } from 'astro';
import type { Database } from '../../../types/database';

export const prerender = false;

type SettingsUpdate = Database['public']['Tables']['site_settings']['Update'];

const EDITABLE_FIELDS = [
  'site_title',
  'tagline',
  'contact_email',
  'phone',
  'studio_location',
  'contact_intro',
  'contact_form_enabled',
  'seo_default_title',
  'seo_default_description',
  'contact_image_media_id',
] as const satisfies readonly (keyof SettingsUpdate)[];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // The only field here that references another row — must be a media id or
  // null (clears it and re-engages the Contact page fallback). The FK and the
  // admin-only RLS update policy are the real guarantees; this just rejects
  // obviously malformed input early with a clear message.
  if ('contact_image_media_id' in body) {
    const value = body.contact_image_media_id;
    if (value !== null && !(typeof value === 'string' && UUID_RE.test(value))) {
      return jsonError('Invalid Contact page image.');
    }
  }

  const update: SettingsUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (update as Record<string, unknown>)[field] = body[field];
    }
  }

  const { data, error } = await supabase.from('site_settings').update(update).eq('id', true).select().single();
  if (error) {
    console.error('[admin settings] update failed', error);
    return jsonError('Could not save. Please try again.', 500);
  }

  return new Response(JSON.stringify({ settings: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
