/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from './types/database';

declare global {
  namespace App {
    interface Locals {
      user?: User;
      supabase?: SupabaseClient<Database>;
    }
  }
}
