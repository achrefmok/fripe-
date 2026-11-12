import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Identifiants du serveur relais (TURN) pour la vidéo des Lives, quand la box ou la 4G bloquent la
// liaison directe. Méthode coturn (`use-auth-secret`) : le nom vaut « expiration:utilisateur », le
// mot de passe est son HMAC-SHA1 avec le secret partagé. Le secret ne quitte jamais le serveur.
const TTL_SECONDS = 6 * 60 * 60;
const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "sessionExpired" }, { status: 401, headers: noStore });
  }

  const secret = process.env.TURN_SECRET;
  const urls = (process.env.TURN_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => /^turns?:/.test(url));

  // Aucun relais configuré : le navigateur se contente du STUN public.
  if (!secret || urls.length === 0) {
    return NextResponse.json({ iceServers: [], ttl: 0 }, { headers: noStore });
  }

  const username = `${Math.floor(Date.now() / 1000) + TTL_SECONDS}:${userId}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");

  return NextResponse.json({ iceServers: [{ urls, username, credential }], ttl: TTL_SECONDS }, { headers: noStore });
}
