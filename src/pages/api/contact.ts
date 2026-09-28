import type { APIRoute } from 'astro';
import { getSupabaseClient } from '../../lib/supabase';
import { sendEmail } from '../../lib/resend';
import { renderContactNotificationEmail } from '../../lib/email-templates';

export const prerender = false;

const MAX_LEN = { name: 200, subject: 300, message: 5000 };
// Every contact-form submission is emailed here (in addition to being stored
// for Admin → Contact). Sent From the verified RESEND_FROM_EMAIL sender, with
// Reply-To set to the visitor.
const CONTACT_NOTIFICATION_TO = 'jtp.skulptur@gmail.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest('Invalid form submission.');
  }

  // Honeypot: a field real visitors never see or fill in.
  if (String(form.get('company') ?? '').length > 0) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  // Minimum time-on-page check: form carries a render timestamp; reject
  // near-instant (bot) submissions.
  const renderedAt = Number(form.get('rendered_at'));
  if (!Number.isFinite(renderedAt) || Date.now() - renderedAt < 1500) {
    return badRequest('Please try again.');
  }

  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const subject = String(form.get('subject') ?? '').trim();
  const message = String(form.get('message') ?? '').trim();
  const artworkSlug = String(form.get('artwork_slug') ?? '').trim();

  if (!name || name.length > MAX_LEN.name) return badRequest('Please provide a valid name.');
  if (!EMAIL_RE.test(email)) return badRequest('Please provide a valid email address.');
  if (subject.length > MAX_LEN.subject) return badRequest('Subject is too long.');
  if (!message || message.length > MAX_LEN.message) return badRequest('Please provide a message.');

  const supabase = getSupabaseClient();

  // The hidden artwork_slug field is just a hint from the page the visitor
  // was on — re-resolved against the database here rather than trusted, so
  // a tampered or stale value can never attach enquiry data to an artwork
  // that doesn't exist (or isn't published). If it doesn't resolve, this
  // silently falls back to a general enquiry rather than failing the whole
  // submission — the message itself still matters even without the context.
  let artworkId: string | null = null;
  let artworkTitle: string | null = null;
  if (artworkSlug) {
    const { data: artwork } = await supabase.from('artworks').select('id, title').eq('slug', artworkSlug).eq('published', true).maybeSingle();
    artworkId = artwork?.id ?? null;
    artworkTitle = artwork?.title?.trim() ?? null;
  }

  const { error } = await supabase.from('contact_messages').insert({
    name,
    email,
    subject: subject || null,
    message,
    artwork_id: artworkId,
    enquiry_type: artworkId ? 'artwork' : 'general',
  });

  if (error) {
    return new Response(JSON.stringify({ error: 'Could not send your message. Please try again later.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // The message is already safely stored at this point, so a failed email
  // must not turn the visitor's submission into an error — it's logged, and
  // the message is still in Admin → Contact.
  try {
    const { subject: mailSubject, html, text } = renderContactNotificationEmail({
      name,
      email,
      subject: subject || null,
      message,
      artworkTitle,
    });
    await sendEmail({ to: CONTACT_NOTIFICATION_TO, subject: mailSubject, html, text, replyTo: email });
  } catch (err) {
    console.error('[contact] notification email failed', err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
