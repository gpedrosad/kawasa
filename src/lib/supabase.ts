import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/config/env";
import type { Database } from "@/types/database";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Cliente Supabase con service_role (solo servidor).
 * Bypassa RLS — no exponer al browser.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (adminClient) {
    return adminClient;
  }

  const env = getEnv();

  adminClient = createClient<Database>(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  return adminClient;
}

export function resetSupabaseAdmin(): void {
  adminClient = null;
}
