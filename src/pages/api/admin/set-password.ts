import type { APIRoute } from 'astro';
import { getSupabaseSsrClient } from '../../../lib/supabase-ssr';

export const prerender = false;

// Public in middleware.ts — this checks auth itself rather than relying on
// the admin gate, since a failed /api/admin/confirm legitimately has no
// session yet when it lands here with ?error=expired.
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');

  if (password !== confirm) {
    return redirect('/admin/set-password?error=mismatch');
  }
  if (password.length < 8) {
    return redirect('/admin/set-password?error=weak');
  }

  const supabase = getSupabaseSsrClient(request, cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirect('/admin/set-password?error=expired');
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return redirect('/admin/set-password?error=updatefailed');
  }

  return redirect('/admin');
};
