import type { APIRoute } from 'astro';
import { getSupabaseSsrClient } from '../../../lib/supabase-ssr';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!email || !password) {
    return redirect('/admin/login?error=missing');
  }

  const supabase = getSupabaseSsrClient(request, cookies);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect('/admin/login?error=invalid');
  }

  return redirect('/admin');
};
