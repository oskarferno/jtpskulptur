/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './types/database';

declare global {
  namespace App {
    interface Locals {
      runtime: {
        env: Record<string, string>;
      };
      user?: User;
      supabase?: SupabaseClient<Database>;
    }
  }

  interface ImportMetaEnv {
    readonly PUBLIC_SUPABASE_URL: string;
    readonly PUBLIC_SUPABASE_ANON_KEY: string;
    readonly SUPABASE_URL: string;
    readonly SUPABASE_SERVICE_ROLE_KEY: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
