import type { APIRoute } from 'astro';
import type { Database } from '../../../../types/database';

export const prerender = false;

type VendorUpdate = Database['public']['Tables']['vendors']['Update'];

const EDITABLE_FIELDS = ['name', 'contact_email', 'notification_email', 'active'] as const satisfies readonly (keyof VendorUpdate)[];

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const supabase = locals.supabase!;
  const { id } = params;
  if (!id) return jsonError('Missing vendor id.');

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const update: VendorUpdate = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      (update as Record<string, unknown>)[field] = body[field];
    }
  }

  if (typeof update.name === 'string' && update.name.trim().length === 0) {
    return jsonError('Name cannot be empty.');
  }

  const { data, error } = await supabase.from('vendors').update(update).eq('id', id).select().single();

  if (error) {
    console.error('[admin vendors] update failed', error);
    return jsonError('Could not save. Please try again.', 500);
  }

  return new Response(JSON.stringify({ vendor: data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
