import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Sans cookie, donc utilisable dans une page mise en cache : ne lit que ce qu'un visiteur anonyme voit.
export function createPublicClient() {
  const { url, publishableKey } = getPublicEnv();

  return createClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
