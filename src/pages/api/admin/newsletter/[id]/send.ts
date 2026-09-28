import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../../lib/require-admin';
import { renderNewsletterEmail } from '../../../../../lib/email-templates';
import { sendEmail } from '../../../../../lib/resend';
import { publicMediaUrl } from '../../../../../lib/media';
import { getSiteUrl } from '../../../../../lib/site-url';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Sends to every CONFIRMED subscriber — never pending/unsubscribed, enforced
// by the .eq('status', 'confirmed') filter below, the only source of truth
// for who's eligible (nothing upstream of this route decides that).
//
// Double-send protection: the UPDATE ... WHERE status = 'draft' below is an
// atomic claim, the same pattern as try_reserve_product_inventory — if two
// requests race (e.g. a double click), only one can ever flip status to
// 'sent' and proceed; the loser gets a 409 before sending anything.
export const POST: APIRoute = async ({ params, locals, request }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  const { id } = params;
  if (!id) return jsonError('Missing newsletter id.');

  const supabase = locals.supabase!;

  const { data: campaign } = await supabase
    .from('newsletter_campaigns')
    .select(
      `status, subject, preview_text, content_markdown, cta_text, cta_url,
       primary_media:primary_image_id (storage_path, bucket)`
    )
    .eq('id', id)
    .single();

  if (!campaign) return jsonError('Newsletter not found.', 404);
  if (campaign.status !== 'draft') return jsonError('This newsletter has already been sent.', 409);
  if (!campaign.subject?.trim()) return jsonError('Add a subject before sending.');
  if (!campaign.content_markdown?.trim()) return jsonError('Add some content before sending.');

  const { data: claimed } = await supabase
    .from('newsletter_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  if (!claimed) return jsonError('This newsletter has already been sent.', 409);

  const { data: subscribers } = await supabase
    .from('newsletter_subscribers')
    .select('email, unsubscribe_token')
    .eq('status', 'confirmed');

  const recipients = subscribers ?? [];
  const siteUrl = getSiteUrl(request); // see lib/site-url.ts — this is a real send to real subscribers
  const imageUrl = campaign.primary_media ? publicMediaUrl(campaign.primary_media.bucket, campaign.primary_media.storage_path) : null;

  let sent = 0;
  for (const subscriber of recipients) {
    const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${subscriber.unsubscribe_token}`;
    const { html, text } = renderNewsletterEmail(
      {
        subject: campaign.subject,
        previewText: campaign.preview_text,
        imageUrl,
        contentMarkdown: campaign.content_markdown,
        ctaText: campaign.cta_text,
        ctaUrl: campaign.cta_url,
      },
      unsubscribeUrl
    );
    try {
      await sendEmail({ to: subscriber.email, subject: campaign.subject, html, text });
      sent += 1;
    } catch (err) {
      console.error(`[newsletter send] failed for ${subscriber.email}`, err);
    }
  }

  await supabase.from('newsletter_campaigns').update({ recipient_count: sent }).eq('id', id);

  return new Response(JSON.stringify({ ok: true, sent, total: recipients.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
