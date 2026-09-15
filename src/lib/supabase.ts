import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';
import type { Database } from '../types/database';

const env = getEnv();

export const supabase = createClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY);
