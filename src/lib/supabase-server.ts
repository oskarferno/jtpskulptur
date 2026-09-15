import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import type { Database } from '../types/database';

/**
 * Server-only Supabase client using the service role key. Bypasses RLS —
 * never expose this client or its key to the browser. Not currently wired
 * to any route (the contact form and admin writes use RLS-scoped clients
 * instead); kept for future admin tooling (e.g. bulk media import scripts)
 * that genuinely needs to bypass RLS.
 */
export function getSupabaseServerClient() {
  const { PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getEnv();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
