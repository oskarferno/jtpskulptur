import { env as cfEnv } from 'cloudflare:workers';

export interface RuntimeEnv {
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function getEnv(): RuntimeEnv {
  return cfEnv as unknown as RuntimeEnv;
}
