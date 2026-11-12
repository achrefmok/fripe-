import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Identifiants du relais TURN de Cloudflare pour la vidéo des Lives, quand la box ou la 4G bloquent
// la liaison directe. La clé TURN reste sur le serveur : on demande à Cloudflare des identifiants
// temporaires, valables 6 h, et on ne les donne qu'à un utilisateur connecté.
const TTL_SECONDS = 6 * 60 * 60;
const noStore = { "Cache-Control": "no-store" };

type IceServer = { urls: string[]; username?: string; credential?: string };

function readIceServers(value: unknown): IceServer[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): IceServer[] => {
    const server = item as { urls?: unknown; username?: unknown; credential?: unknown } | null;
    const urls = (Array.isArray(server?.urls) ? server.urls : [server?.urls])
      .filter((url): url is string => typeof url === "string" && /^(stun|turns?):/.test(url))
      // Le port 53 est bloqué par les navigateurs : il ne ferait que retarder la liaison.
      .filter((url) => !/:53(\?|$)/.test(url));
    if (urls.length === 0) return [];

    const username = typeof server?.username === "string" ? server.username : undefined;
    const credential = typeof server?.credential === "string" ? server.credential : undefined;
    return [{ urls, ...(username && credential ? { username, credential } : {}) }];
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    return NextResponse.json({ error: "sessionExpired" }, { status: 401, headers: noStore });
  }

  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (!keyId || !token) {
    // Relais à identifiants fixes (offre gratuite d'ExpressTURN, par exemple). Ils ne sont donnés
    // qu'aux utilisateurs connectés, mais ne changent pas : à remplacer par Cloudflare dès que possible.
    // « hôte:port » sans préfixe est compris comme une adresse turn:.
    const urls = (process.env.TURN_URLS ?? "")
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => (/^(stun|turns?):/.test(url) ? url : `turn:${url}`));
    const username = process.env.TURN_USERNAME;
    const credential = process.env.TURN_PASSWORD;
    const iceServers = username && credential ? readIceServers([{ urls, username, credential }]) : [];

    // Aucun relais configuré : le navigateur se contente du STUN public.
    return NextResponse.json({ iceServers, ttl: iceServers.length ? TTL_SECONDS : 0 }, { headers: noStore });
  }

  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) throw new Error(`cloudflare_turn_${response.status}`);

    const body = (await response.json()) as { iceServers?: unknown };
    return NextResponse.json({ iceServers: readIceServers(body.iceServers), ttl: TTL_SECONDS }, { headers: noStore });
  } catch (error) {
    // Relais indisponible : la vidéo tente quand même la liaison directe.
    console.error("turn", error instanceof Error ? error.message : error);
    return NextResponse.json({ iceServers: [], ttl: 0 }, { headers: noStore });
  }
}
