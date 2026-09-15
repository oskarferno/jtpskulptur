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
