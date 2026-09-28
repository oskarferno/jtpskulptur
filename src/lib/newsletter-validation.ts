// Shared field validation for the newsletter composer's create/update routes.
// Kept separate from the routes themselves since create (POST) and update
// (PATCH) apply the exact same rules to the exact same fields.

export interface NewsletterFields {
  subject?: string;
  preview_text?: string | null;
  primary_image_id?: string | null;
  content_markdown?: string;
  cta_text?: string | null;
  cta_url?: string | null;
}

const MAX_SUBJECT = 200;
const MAX_PREVIEW_TEXT = 300;
const MAX_CTA_TEXT = 100;
const MAX_CONTENT = 20000;

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes and validates the subset of `body` that was actually sent —
 * callers pass only the fields present in the request, so a PATCH that
 * omits `subject` isn't required to re-validate it. `requireSubject` is
 * true for creation, where a subject is mandatory from the start.
 */
export function validateNewsletterFields(
  body: Record<string, unknown>,
  { requireSubject }: { requireSubject: boolean }
): { ok: true; value: NewsletterFields } | { ok: false; error: string } {
  const value: NewsletterFields = {};

  if ('subject' in body || requireSubject) {
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    if (!subject) return { ok: false, error: 'Subject is required.' };
    if (subject.length > MAX_SUBJECT) return { ok: false, error: `Subject must be ${MAX_SUBJECT} characters or fewer.` };
    value.subject = subject;
  }

  if ('preview_text' in body) {
    const previewText = typeof body.preview_text === 'string' ? body.preview_text.trim() : '';
    if (previewText.length > MAX_PREVIEW_TEXT) {
      return { ok: false, error: `Preview text must be ${MAX_PREVIEW_TEXT} characters or fewer.` };
    }
    value.preview_text = previewText || null;
  }

  if ('primary_image_id' in body) {
    value.primary_image_id = typeof body.primary_image_id === 'string' && body.primary_image_id ? body.primary_image_id : null;
  }

  if ('content_markdown' in body) {
    const content = typeof body.content_markdown === 'string' ? body.content_markdown : '';
    if (content.length > MAX_CONTENT) return { ok: false, error: `Content must be ${MAX_CONTENT} characters or fewer.` };
    value.content_markdown = content;
  }

  if ('cta_text' in body) {
    const ctaText = typeof body.cta_text === 'string' ? body.cta_text.trim() : '';
    if (ctaText.length > MAX_CTA_TEXT) return { ok: false, error: `CTA text must be ${MAX_CTA_TEXT} characters or fewer.` };
    value.cta_text = ctaText || null;
  }

  if ('cta_url' in body) {
    const ctaUrl = typeof body.cta_url === 'string' ? body.cta_url.trim() : '';
    if (ctaUrl && !isValidHttpUrl(ctaUrl)) {
      return { ok: false, error: 'CTA URL must be a valid http:// or https:// link.' };
    }
    value.cta_url = ctaUrl || null;
  }

  return { ok: true, value };
}
