import { defineMiddleware } from 'astro:middleware';
import { getSupabaseSsrClient } from './lib/supabase-ssr';

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, url, locals, redirect } = context;

  if (!url.pathname.startsWith('/admin')) {
    return next();
  }

  const runtimeEnv = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env;
  const supabase = getSupabaseSsrClient(request, cookies, runtimeEnv);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (url.pathname === '/admin/login') {
    return next();
  }

  if (!user) {
    return redirect('/admin/login');
  }

  locals.user = user;
  locals.supabase = supabase;

  return next();
});
