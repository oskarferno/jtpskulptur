import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { getEnv } from './env';
import type { Database } from '../types/database';

/**
 * Cookie-bound Supabase client for SSR routes (middleware, /admin pages,
 * server API routes). Uses the anon key — RLS + the authenticated user's
 * session decide what's readable/writable, never the service role.
 */
export function getSupabaseSsrClient(request: Request, cookies: AstroCookies) {
  const { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } = getEnv();

  return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    // No client-side code ever reads this cookie (no browser Supabase client,
    // no onAuthStateChange) — tighten the library's defaults (httpOnly:
    // false, no secure flag) since nothing here needs JS access to it.
    // `secure` is derived from the request rather than hardcoded true: local
    // dev runs over plain http://localhost, and browsers silently drop
    // Secure cookies on non-HTTPS origins.
    cookieOptions: { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax' },
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, { ...options, path: '/' });
        });
      },
    },
  });
}
