import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";

// Rafraîchit la session et réécrit les cookies sur la réponse produite par next-intl.
export async function updateSession(request: NextRequest, response: NextResponse) {
  if (!isSupabaseConfigured()) {
    return response;
  }

  const { url, publishableKey } = getPublicEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}
