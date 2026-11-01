import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils/safe-path";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change"];

// `next` vient du lien reçu par e-mail : seul son chemin est conservé, sur notre propre domaine.
function nextPath(value: string | null) {
  if (!value) return "/compte";

  try {
    const url = new URL(value, getSiteUrl());
    return url.origin === new URL(getSiteUrl()).origin
      ? safeInternalPath(url.pathname)
      : "/compte";
  } catch {
    return "/compte";
  }
}

// Vérification par token_hash : le lien fonctionne même ouvert dans une autre appli ou un autre
// navigateur que celui de l'inscription, cas courant sur mobile.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const destination = nextPath(searchParams.get("next"));

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (!error) {
      return NextResponse.redirect(new URL(destination, getSiteUrl()));
    }
  }

  const invalid = destination.startsWith("/ar") ? "/ar/lien-invalide" : "/lien-invalide";
  return NextResponse.redirect(new URL(invalid, getSiteUrl()));
}
