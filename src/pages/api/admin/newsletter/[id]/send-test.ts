import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/require-admin';
import { renderNewsletterEmail } from '../../../../../lib/email-templates';
import { sendEmail } from '../../../../../lib/resend';
import { publicMediaUrl } from '../../../../../lib/media';
import { getSiteUrl } from '../../../../../lib/site-url';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Sends exactly one email, to an address the admin types in by hand, using
// the campaign's *saved* content. Never touches status/sent_at/recipient_count
// and never queries newsletter_subscribers — a test send has no way to reach
// the real subscriber list even if it wanted to.
export const POST: APIRoute = async ({ params, request, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const { id } = params;
  if (!id) return jsonError('Missing newsletter id.');

  const supabase = locals.supabase!;

  let body: { testEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const testEmail = typeof body.testEmail === 'string' ? body.testEmail.trim() : '';
  if (!EMAIL_RE.test(testEmail)) return jsonError('A valid test recipient email is required.');

  const { data: campaign } = await supabase
    .from('newsletter_campaigns')
    .select(
      `subject, preview_text, content_markdown, cta_text, cta_url,
       primary_media:primary_image_id (storage_path, bucket)`
    )
    .eq('id', id)
    .single();

  if (!campaign) return jsonError('Newsletter not found.', 404);
  if (!campaign.subject?.trim()) return jsonError('Add a subject before sending a test.');

  const siteUrl = getSiteUrl(request); // see lib/site-url.ts
  const imageUrl = campaign.primary_media ? publicMediaUrl(campaign.primary_media.bucket, campaign.primary_media.storage_path) : null;

  const { html, text } = renderNewsletterEmail(
    {
      subject: campaign.subject,
      previewText: campaign.preview_text,
      imageUrl,
      contentMarkdown: campaign.content_markdown,
      ctaText: campaign.cta_text,
      ctaUrl: campaign.cta_url,
    },
    `${siteUrl}/api/newsletter/unsubscribe?token=preview`
  );

  try {
    await sendEmail({ to: testEmail, subject: `[TEST] ${campaign.subject}`, html, text });
  } catch (err) {
    console.error('[newsletter send-test] failed', err);
    return jsonError('Could not send the test email. Please try again.', 502);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
