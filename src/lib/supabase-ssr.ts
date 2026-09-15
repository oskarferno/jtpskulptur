import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import type { Database } from '../types/database';

/**
 * Cookie-bound Supabase client for SSR routes (middleware, /admin pages,
 * server API routes). Uses the anon key — RLS + the authenticated user's
 * session decide what's readable/writable, never the service role.
 */
export function getSupabaseSsrClient(
  request: Request,
  cookies: AstroCookies,
  runtimeEnv?: Record<string, string>
) {
  const url = runtimeEnv?.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = runtimeEnv?.PUBLIC_SUPABASE_ANON_KEY ?? import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  return createServerClient<Database>(url, anonKey, {
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
