import { createClient } from '@supabase/supabase-js';
import type { AstroGlobal } from 'astro';
import type { Database } from '../types/database';

/**
 * Server-only Supabase client. Reads the service role key from the Cloudflare
 * runtime (production) or process.env (local `astro dev`/`.env`). Never expose
 * this client or its key to the browser.
 */
export function getSupabaseServerClient(Astro: Pick<AstroGlobal, 'locals'>) {
  const runtimeEnv = (Astro.locals as { runtime?: { env?: Record<string, string> } })
    .runtime?.env;

  const url = runtimeEnv?.SUPABASE_URL ?? import.meta.env.SUPABASE_URL;
  const serviceRoleKey =
    runtimeEnv?.SUPABASE_SERVICE_ROLE_KEY ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
