import { defineMiddleware } from 'astro:middleware';
import { getSupabaseSsrClient } from './lib/supabase-ssr';
import { getEnv } from './lib/env';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/api/admin/login']);

function withSecurityHeaders(response: Response): Response {
  const { PUBLIC_SUPABASE_URL } = getEnv();

  const csp = [
    "default-src 'self'",
    `img-src 'self' data: ${PUBLIC_SUPABASE_URL}`,
    // 'unsafe-inline' here: Astro inlines small page-specific scripts at
    // build time (their hash changes per-deploy, so a hash/nonce policy
    // isn't practical without extra build tooling). This is an accepted
    // trade-off, not a live gap — nothing in this codebase renders
    // unescaped/user-controlled HTML (no set:html, no dangerouslySetInnerHTML),
    // which is the primary thing script-src strictness guards against.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self'",
    "font-src 'self'",
    `connect-src 'self' ${PUBLIC_SUPABASE_URL}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, url, locals, redirect } = context;

  const isAdminArea = url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin');
  if (!isAdminArea) {
    return withSecurityHeaders(await next());
  }

  if (PUBLIC_ADMIN_PATHS.has(url.pathname)) {
    return withSecurityHeaders(await next());
  }

  const supabase = getSupabaseSsrClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (url.pathname.startsWith('/api/')) {
      return withSecurityHeaders(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return withSecurityHeaders(redirect('/admin/login'));
  }

  locals.user = user;
  locals.supabase = supabase;

  return withSecurityHeaders(await next());
});
