import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const prerender = false;

const MAX_LEN = { name: 200, subject: 300, message: 5000 };
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

  if (!name || name.length > MAX_LEN.name) return badRequest('Please provide a valid name.');
  if (!EMAIL_RE.test(email)) return badRequest('Please provide a valid email address.');
  if (subject.length > MAX_LEN.subject) return badRequest('Subject is too long.');
  if (!message || message.length > MAX_LEN.message) return badRequest('Please provide a message.');

  const { error } = await supabase.from('contact_messages').insert({
    name,
    email,
    subject: subject || null,
    message,
  });

  if (error) {
    return new Response(JSON.stringify({ error: 'Could not send your message. Please try again later.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
