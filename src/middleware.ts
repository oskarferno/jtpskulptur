import { defineMiddleware } from 'astro:middleware';
import { getSupabaseSsrClient } from './lib/supabase-ssr';
import { getEnv } from './lib/env';
import { isProductionHost } from './lib/production-host';

// /admin/confirm and its POST are public: they're reached via a Supabase
// invite/recovery email link before any session cookie exists. GET renders
// an inert "Continue" button (see confirm.astro's comment on why — an
// automated link-scanner prefetching the URL must not be able to consume
// the one-time token); the POST verifies the token and establishes the
// session itself, the same trust model /api/admin/login uses for a
// password.
//
// /admin/set-password and its POST are ALSO public — deliberately, even
// though a real visit normally already has a session by the time it gets
// here (set moments earlier by /api/admin/confirm). Gating this page behind
// the normal admin check created a bug: on a FAILED verification there is
// no session, so the failure redirect (/admin/set-password?error=expired)
// got immediately re-redirected to /admin/login by this same gate, silently
// swallowing the error message. Both routes now check auth for themselves
// instead of relying on this middleware (see their own files).
const PUBLIC_ADMIN_PATHS = new Set([
  '/admin/login',
  '/api/admin/login',
  '/admin/confirm',
  '/api/admin/confirm',
  '/admin/set-password',
  '/api/admin/set-password',
]);
const PUBLIC_VENDOR_PATHS = new Set(['/vendor/login', '/api/vendor/login']);

// Google Analytics needs to load its tag and send hits, which the strict
// policy below would otherwise block. Granted only to public pages on the
// production hostname (see lib/production-host.ts) — never to admin/vendor
// responses, workers.dev, or previews, which keep the original policy.
const GA_SCRIPT_SRC = ' https://www.googletagmanager.com';
const GA_IMG_SRC = ' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com';
const GA_CONNECT_SRC =
  ' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com';

function withSecurityHeaders(response: Response, allowAnalytics = false): Response {
  const { PUBLIC_SUPABASE_URL } = getEnv();

  // Some responses (e.g. astro:assets' /_image endpoint, backed by the
  // Cloudflare Images binding) come back with immutable headers — mutating
  // them in place throws. Building a fresh Headers/Response instead works
  // for every response shape.
  const headers = new Headers(response.headers);

  const csp = [
    "default-src 'self'",
    `img-src 'self' data: ${PUBLIC_SUPABASE_URL}${allowAnalytics ? GA_IMG_SRC : ''}`,
    // 'unsafe-inline' here: Astro inlines small page-specific scripts at
    // build time (their hash changes per-deploy, so a hash/nonce policy
    // isn't practical without extra build tooling). This is an accepted
    // trade-off — but not an unconditional one: admin-authored Markdown
    // (Journal body, Newsletter content) IS rendered via set:html
    // (journal/[slug].astro, admin/newsletter/[id].astro), so this CSP does
    // NOT block a <script> tag embedded there from executing. The actual
    // guard against that is lib/markdown.ts's renderMarkdown(), which
    // escapes raw HTML in admin Markdown input before it ever reaches
    // set:html — treat that as the real XSS boundary, not this policy.
    `script-src 'self' 'unsafe-inline'${allowAnalytics ? GA_SCRIPT_SRC : ''}`,
    // Dev-only: Vite's HMR injects CSS via inline <style> tags, which a
    // strict style-src blocks — production always ships a linked stylesheet
    // instead, so this relaxation never reaches the deployed site.
    import.meta.env.DEV ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "font-src 'self'",
    `connect-src 'self' ${PUBLIC_SUPABASE_URL}${allowAnalytics ? GA_CONNECT_SRC : ''}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  headers.set('Content-Security-Policy', csp);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, url, locals, redirect } = context;

  // One URL per page: /about/ and /about were both served as 200, each
  // declaring itself canonical. Only safe (GET/HEAD) requests are redirected —
  // a POST to a trailing-slash URL must never be turned into a GET.
  if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.length > 1 && url.pathname.endsWith('/')) {
    return withSecurityHeaders(redirect(url.pathname.replace(/\/+$/, '') + url.search, 301));
  }

  const isAdminArea = url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin');
  const isVendorArea = url.pathname.startsWith('/vendor') || url.pathname.startsWith('/api/vendor');

  if (!isAdminArea && !isVendorArea) {
    return withSecurityHeaders(await next(), isProductionHost(url.hostname));
  }

  if (isAdminArea) {
    if (PUBLIC_ADMIN_PATHS.has(url.pathname)) {
      return withSecurityHeaders(await next());
    }

    const supabase = getSupabaseSsrClient(request, cookies);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      if (url.pathname.startsWith('/api/')) return withSecurityHeaders(unauthorized());
      return withSecurityHeaders(redirect('/admin/login'));
    }

    // Security audit finding L-2: this used to only check "is some Supabase
    // user logged in" — not role='admin' — same gap the vendor branch below
    // already guards against for its own area. RLS's is_admin() policies
    // were always the real backstop (verified live: a non-admin session
    // reading any admin-only table gets zero rows, and every write is
    // rejected), so this was never an actual data-exposure bug — but a
    // vendor typing their own valid credentials into /admin/login instead of
    // /vendor/login would land inside a confusing, mostly-empty /admin UI
    // shell rather than being cleanly redirected away. Explicit check here,
    // for the same defense-in-depth reason the vendor branch already has one.
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') {
      if (url.pathname.startsWith('/api/')) return withSecurityHeaders(unauthorized());
      return withSecurityHeaders(redirect('/admin/login?error=forbidden'));
    }

    locals.user = user;
    locals.supabase = supabase;

    return withSecurityHeaders(await next());
  }

  // Vendor area. A vendor is any authenticated user whose profile has a
  // vendor_id and role 'vendor' OR 'admin' — checked on every request (not
  // just login), since role/vendor_id can change out from under an existing
  // session (a vendor deactivated by admin should lose access immediately,
  // not just fail to log in again next time). Admin-as-vendor mirrors
  // is_vendor()/current_vendor_id() in migration 0023 — this is UX/defense
  // in depth on top of that RLS boundary, not the boundary itself.
  if (PUBLIC_VENDOR_PATHS.has(url.pathname)) {
    return withSecurityHeaders(await next());
  }

  const supabase = getSupabaseSsrClient(request, cookies);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (url.pathname.startsWith('/api/')) return withSecurityHeaders(unauthorized());
    return withSecurityHeaders(redirect('/vendor/login'));
  }

  const { data: profile } = await supabase.from('profiles').select('role, vendor_id').eq('id', user.id).maybeSingle();

  if (!profile || !(profile.role === 'vendor' || profile.role === 'admin') || !profile.vendor_id) {
    if (url.pathname.startsWith('/api/')) return withSecurityHeaders(unauthorized());
    return withSecurityHeaders(redirect('/vendor/login?error=forbidden'));
  }

  locals.user = user;
  locals.supabase = supabase;
  locals.vendorId = profile.vendor_id;

  return withSecurityHeaders(await next());
});
