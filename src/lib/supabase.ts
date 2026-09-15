import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import type { Database } from '../types/database';

// Lazily created: Cloudflare's `cloudflare:workers` env binding is only
// reliably populated once request handling has begun, not at module
// evaluation time (cold start). Building the client eagerly at module scope
// works in local dev/preview emulation but 500s in the real deployed Worker.
let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    const env = getEnv();
    client = createClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);
  }
  return client;
}
