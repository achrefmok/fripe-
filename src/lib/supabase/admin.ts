import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Contourne RLS. Réservé aux tâches serveur sans utilisateur (crons, webhooks) ;
// le protège `server-only`, qui fait échouer le build s'il atteint le navigateur.
export function createAdminClient() {
  const { url } = getPublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY manquante.");
  }

  return createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
