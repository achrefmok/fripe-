import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/proxy";

const handleI18n = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  return updateSession(request, handleI18n(request));
}

export const config = {
  matcher: ["/((?!api|auth|_next|_vercel|serwist|sw\\.js|.*\\..*).*)"],
};
