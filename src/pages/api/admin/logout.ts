import type { APIRoute } from 'astro';
import { getSupabaseSsrClient } from '../../../lib/supabase-ssr';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = getSupabaseSsrClient(request, cookies);
  await supabase.auth.signOut();
  return redirect('/admin/login');
};
