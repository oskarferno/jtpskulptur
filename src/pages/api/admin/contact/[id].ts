import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/require-admin';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ok = () =>
  new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

// Marks a contact message read or unread. Goes through the RLS-scoped client
// (locals.supabase) — the "admin can update contact_messages" policy is the
// real boundary; requireAdmin() is the explicit check on top of it.
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const { id } = params;
  if (!id) return jsonError('Missing message id.');

  let body: { read?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }
  if (typeof body.read !== 'boolean') return jsonError('"read" must be true or false.');

  const { data, error } = await locals
    .supabase!.from('contact_messages')
    .update({ read: body.read })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[admin contact] update failed', error);
    return jsonError('Could not update. Please try again.', 500);
  }
  if (!data) return jsonError('Message not found.', 404);

  return ok();
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const { id } = params;
  if (!id) return jsonError('Missing message id.');

  const { data, error } = await locals
    .supabase!.from('contact_messages')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[admin contact] delete failed', error);
    return jsonError('Could not delete. Please try again.', 500);
  }
  if (!data) return jsonError('Message not found.', 404);

  return ok();
};
