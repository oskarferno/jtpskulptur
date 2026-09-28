import type { APIRoute } from 'astro';
import { getSupabaseSsrClient } from '../../../lib/supabase-ssr';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!email || !password) {
    return redirect('/vendor/login?error=missing');
  }

  const supabase = getSupabaseSsrClient(request, cookies);

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return redirect('/vendor/login?error=invalid');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, vendor_id')
    .eq('id', user?.id ?? '')
    .maybeSingle();

  if (!profile || !(profile.role === 'vendor' || profile.role === 'admin') || !profile.vendor_id) {
    await supabase.auth.signOut();
    return redirect('/vendor/login?error=forbidden');
  }

  return redirect('/vendor');
};
