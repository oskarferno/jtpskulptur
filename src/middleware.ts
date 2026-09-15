import { defineMiddleware } from 'astro:middleware';
import { getSupabaseSsrClient } from './lib/supabase-ssr';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, url, locals, redirect } = context;

  const isAdminArea = url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin');
  if (!isAdminArea) {
    return next();
  }

  if (PUBLIC_ADMIN_PATHS.has(url.pathname)) {
    return next();
  }

  const supabase = getSupabaseSsrClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return redirect('/admin/login');
  }

  locals.user = user;
  locals.supabase = supabase;

  return next();
});
