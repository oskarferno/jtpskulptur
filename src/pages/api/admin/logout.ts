import type { APIRoute } from 'astro';
import { getSupabaseSsrClient } from '../../../lib/supabase-ssr';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
  const runtimeEnv = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env;
  const supabase = getSupabaseSsrClient(request, cookies, runtimeEnv);
  await supabase.auth.signOut();
  return redirect('/admin/login');
};
