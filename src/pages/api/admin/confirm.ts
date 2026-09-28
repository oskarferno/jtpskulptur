import type { APIRoute } from 'astro';
import { getSupabaseSsrClient } from '../../../lib/supabase-ssr';

export const prerender = false;

// Reachable only via a real click on /admin/confirm's button (see that
// page's comment on why GET must stay inert). verifyOtp() consumes the
// one-time token_hash and establishes the session in this single request —
// the redirect to /admin/set-password then carries that session cookie
// forward normally, no separate email-click hop involved at that point.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const tokenHash = String(form.get('token_hash') ?? '');
  const type = String(form.get('type') ?? '');

  if (!tokenHash || !(type === 'recovery' || type === 'invite' || type === 'email_change')) {
    return redirect('/admin/confirm?error=missing');
  }

  const supabase = getSupabaseSsrClient(request, cookies);
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return redirect('/admin/set-password?error=expired');
  }

  return redirect('/admin/set-password');
};
