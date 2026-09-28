import type { APIRoute } from 'astro';
import { getSupabaseServerClient } from '../../../lib/supabase-server';
import { sendEmail } from '../../../lib/resend';
import { renderNewsletterConfirmEmail } from '../../../lib/email-templates';
import { getSiteUrl } from '../../../lib/site-url';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid form submission.' }), { status: 400 });
  }

  // Same honeypot + timing pattern as the contact form (src/pages/api/contact.ts).
  if (String(form.get('company') ?? '').length > 0) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
  const renderedAt = Number(form.get('rendered_at'));
  if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < 1500) {
    return new Response(JSON.stringify({ error: 'Please try again.' }), { status: 400 });
  }

  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const source = String(form.get('source') ?? '').slice(0, 50) || null;

  if (!EMAIL_RE.test(email)) {
    return new Response(JSON.stringify({ error: 'Please provide a valid email address.' }), { status: 400 });
  }

  const admin = getSupabaseServerClient();

  const { data: existing } = await admin
    .from('newsletter_subscribers')
    .select('id, status, confirm_token')
    .eq('email', email)
    .maybeSingle();

  let confirmToken: string;

  if (!existing) {
    const { data: inserted, error } = await admin
      .from('newsletter_subscribers')
      .insert({ email, source })
      .select('confirm_token')
      .single();
    if (error || !inserted) {
      return new Response(JSON.stringify({ error: 'Could not subscribe. Please try again.' }), { status: 500 });
    }
    confirmToken = inserted.confirm_token;
  } else if (existing.status === 'confirmed') {
    // Already subscribed — respond the same as a fresh signup either way, so
    // this endpoint can't be used to check whether an email is subscribed.
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } else {
    // 'pending' or 'unsubscribed' — resend the confirmation email with the
    // existing token rather than creating a duplicate row (email is unique).
    confirmToken = existing.confirm_token;
    if (existing.status === 'unsubscribed') {
      await admin.from('newsletter_subscribers').update({ status: 'pending', unsubscribed_at: null }).eq('id', existing.id);
    }
  }

  // See lib/site-url.ts — was previously Astro.site (permanently
  // jtpskulptur.com), which meant a subscriber confirming before that
  // domain is live would be sent to a link that 404s and can never confirm.
  const siteUrl = getSiteUrl(request);
  const confirmUrl = `${siteUrl}/api/newsletter/confirm?token=${confirmToken}`;
  const { subject, html, text } = renderNewsletterConfirmEmail(confirmUrl);
  await sendEmail({ to: email, subject, html, text }).catch((err) =>
    console.error('[newsletter subscribe] confirmation email failed', err)
  );

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
