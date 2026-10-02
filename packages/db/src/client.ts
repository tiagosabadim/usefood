import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type AppSupabaseClient = SupabaseClient<Database>;

/** Cliente tipado do Supabase. Use a chave publicável; nunca a service role no navegador. */
export function createSupabaseClient(url: string, publishableKey: string): AppSupabaseClient {
  return createClient<Database>(url, publishableKey);
}
