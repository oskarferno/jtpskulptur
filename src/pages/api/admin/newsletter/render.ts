import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../../lib/require-admin';
import { renderNewsletterEmail } from '../../../../lib/email-templates';
import { getSiteUrl } from '../../../../lib/site-url';

export const prerender = false;

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Renders the exact HTML a real send would produce, from whatever's
// currently in the composer — including unsaved edits. Read-only: no DB
// write, no email sent, so it doesn't need a saved campaign id to work.
export const POST: APIRoute = async ({ request, locals }) => {
  const [isAdmin, forbidden] = await requireAdmin(locals);
  if (!isAdmin) return forbidden;

  let body: {
    subject?: unknown;
    previewText?: unknown;
    imageUrl?: unknown;
    contentMarkdown?: unknown;
    ctaText?: unknown;
    ctaUrl?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.');
  }

  const siteUrl = getSiteUrl(request); // see lib/site-url.ts

  const { html } = renderNewsletterEmail(
    {
      subject: typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : '(no subject)',
      previewText: typeof body.previewText === 'string' ? body.previewText : null,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : null,
      contentMarkdown: typeof body.contentMarkdown === 'string' ? body.contentMarkdown : '',
      ctaText: typeof body.ctaText === 'string' ? body.ctaText : null,
      ctaUrl: typeof body.ctaUrl === 'string' ? body.ctaUrl : null,
    },
    `${siteUrl}/api/newsletter/unsubscribe?token=preview`
  );

  return new Response(JSON.stringify({ html }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
