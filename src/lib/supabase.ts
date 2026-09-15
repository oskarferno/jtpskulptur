import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(url, anonKey);
