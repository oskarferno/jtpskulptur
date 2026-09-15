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
] as const satisfies readonly (keyof SettingsUpdate)[];

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

  const update: SettingsUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (update as Record<string, unknown>)[field] = body[field];
    }
  }

  const { data, error } = await supabase.from('site_settings').update(update).eq('id', true).select().single();
  if (error) return jsonError(error.message, 500);

  return new Response(JSON.stringify({ settings: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
