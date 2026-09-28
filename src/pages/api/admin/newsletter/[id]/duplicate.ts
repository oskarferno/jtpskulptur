import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/require-admin';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Copies a campaign's content into a brand-new draft — the only sanctioned
// way to reuse a sent newsletter, since sent campaigns themselves are frozen.
export const POST: APIRoute = async ({ params, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const { id } = params;
  if (!id) return jsonError('Missing newsletter id.');

  const supabase = locals.supabase!;

  const { data: source, error: fetchError } = await supabase
    .from('newsletter_campaigns')
    .select('subject, preview_text, primary_image_id, content_markdown, cta_text, cta_url')
    .eq('id', id)
    .single();

  if (fetchError || !source) return jsonError('Newsletter not found.', 404);

  const { data, error } = await supabase
    .from('newsletter_campaigns')
    .insert({
      subject: `Copy of ${source.subject}`,
      preview_text: source.preview_text,
      primary_image_id: source.primary_image_id,
      content_markdown: source.content_markdown,
      cta_text: source.cta_text,
      cta_url: source.cta_url,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[admin newsletter] duplicate failed', error);
    return jsonError('Could not duplicate. Please try again.', 500);
  }

  return new Response(JSON.stringify({ id: data.id }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
};
