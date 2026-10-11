import type { APIRoute } from 'astro';
import { EMAIL_RE, normalizeEmail, requestSubscription } from '../../../lib/newsletter';
import { getNewsletterDeps } from '../../../lib/newsletter-deps';

export const prerender = false;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Invalid form submission.' }, 400);
  }

  // Same honeypot + timing pattern as the contact form (src/pages/api/contact.ts).
  // The honeypot's name is deliberately not something a browser or password
  // manager would autofill (it used to be "company", which they do) — a real
  // visitor with a saved company name would otherwise be silently dropped
  // here while the form told them to check their email.
  if (String(form.get('hp_notes') ?? '').length > 0) {
    return json({ ok: true });
  }
  const renderedAt = Number(form.get('rendered_at'));
  if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < 1500) {
    return json({ error: 'Please try again.' }, 400);
  }

  const email = normalizeEmail(form.get('email'));
  const source = String(form.get('source') ?? '').slice(0, 50) || null;

  if (!EMAIL_RE.test(email)) {
    return json({ error: 'Please provide a valid email address.' }, 400);
  }

  try {
    const outcome = await requestSubscription({ email, source }, getNewsletterDeps(request));

    // Saved vs. emailed are separate outcomes, and a failed send is never
    // reported as success. Every other outcome — email sent, one sent a
    // moment ago, or already subscribed — gets the identical answer, so this
    // endpoint can't be used to find out whether an address is on the list.
    if (outcome.kind === 'email_failed') {
      console.error('[newsletter subscribe] confirmation email not sent:', outcome.reason);
      return json(
        { error: "We couldn't send the confirmation email just now. Please try again in a few minutes." },
        502
      );
    }
    return json({ ok: true });
  } catch (error) {
    console.error('[newsletter subscribe] could not save subscriber:', error instanceof Error ? error.message : error);
    return json({ error: 'Could not subscribe. Please try again.' }, 500);
  }
};
