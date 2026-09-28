import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/require-admin';
import { validateNewsletterFields } from '../../../../lib/newsletter-validation';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Updates a draft in place. Sent campaigns are frozen — the composer never
// shows an editable form for them (see /admin/newsletter/[id].astro), but
// this is re-checked here too since that's a UI convenience, not a boundary.
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const { id } = params;
  if (!id) return jsonError('Missing newsletter id.');

  const supabase = locals.supabase!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const validated = validateNewsletterFields(body, { requireSubject: false });
  if (!validated.ok) return jsonError(validated.error);

  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .update(validated.value)
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[admin newsletter] update failed', error);
    return jsonError('Could not save. Please try again.', 500);
  }
  if (!data) return jsonError('This newsletter has already been sent and can no longer be edited.', 409);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Deletes a draft. Same freeze as PATCH — a sent campaign is the permanent
// record of what subscribers actually received, so it's never deletable,
// only duplicatable into a new draft (see [id]/duplicate.ts).
export const DELETE: APIRoute = async ({ params, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const { id } = params;
  if (!id) return jsonError('Missing newsletter id.');

  const supabase = locals.supabase!;

  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .delete()
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[admin newsletter] delete failed', error);
    return jsonError('Could not delete. Please try again.', 500);
  }
  if (!data) return jsonError('This newsletter has already been sent and can no longer be deleted.', 409);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
