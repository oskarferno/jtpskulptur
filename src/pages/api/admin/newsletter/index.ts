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

// Creates a new draft. Composer pages always operate on a saved campaign id
// (see /admin/newsletter/new.astro), so this is the first call a brand-new
// newsletter makes before Preview/Send Test/Send Newsletter become available.
export const POST: APIRoute = async ({ request, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const supabase = locals.supabase!;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const validated = validateNewsletterFields(body, { requireSubject: true });
  if (!validated.ok) return jsonError(validated.error);

  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .insert({ ...validated.value, subject: validated.value.subject!, status: 'draft' })
    .select('id')
    .single();

  if (error) {
    console.error('[admin newsletter] create failed', error);
    return jsonError('Could not create newsletter. Please try again.', 500);
  }

  return new Response(JSON.stringify({ id: data.id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
