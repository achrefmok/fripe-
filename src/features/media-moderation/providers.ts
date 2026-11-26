import type { NudityScores, ProviderAnalysis } from "./policy";

// Le classifieur qui juge le contenu. Aucun modèle local fiable de détection de nudité n'est livré
// avec l'application : sans fournisseur configuré, seule la provenance IA déclarée est lue.
export interface ModerationProvider {
  name: string;
  analyzeImage(bytes: Uint8Array, mime: string): Promise<ProviderAnalysis>;
  analyzeVideo(bytes: Uint8Array, mime: string): Promise<ProviderAnalysis>;
}

type Env = Record<string, string | undefined>;

export class ProviderError extends Error {}

const TIMEOUT_MS = 20_000;
const VIDEO_TIMEOUT_MS = 90_000;

// Sightengine : nudity-2.1 (activité sexuelle, parties génitales, érotisme, suggestif) et genai
// (probabilité d'une image générée par IA). Les médias sont envoyés à ce service pour analyse :
// à mentionner dans la politique de confidentialité avant l'activation en production.
type SightengineNudity = {
  sexual_activity?: number;
  sexual_display?: number;
  erotica?: number;
  very_suggestive?: number;
};
type SightengineResult = { nudity?: SightengineNudity; type?: { ai_generated?: number } };

function nudityFrom(raw: SightengineNudity | undefined): NudityScores | null {
  if (!raw) return null;
  return {
    sexualActivity: raw.sexual_activity ?? 0,
    sexualDisplay: raw.sexual_display ?? 0,
    erotica: raw.erotica ?? 0,
    verySuggestive: raw.very_suggestive ?? 0,
  };
}

// Le pire score de chaque catégorie sur l'ensemble des images analysées (les images d'une vidéo).
export function mergeAnalyses(provider: string, results: SightengineResult[]): ProviderAnalysis {
  const nudities = results.map((result) => nudityFrom(result.nudity)).filter((entry): entry is NudityScores => entry !== null);
  const ai = results.map((result) => result.type?.ai_generated).filter((score): score is number => typeof score === "number");

  return {
    provider,
    nudity: nudities.length
      ? {
          sexualActivity: Math.max(...nudities.map((entry) => entry.sexualActivity)),
          sexualDisplay: Math.max(...nudities.map((entry) => entry.sexualDisplay)),
          erotica: Math.max(...nudities.map((entry) => entry.erotica)),
          verySuggestive: Math.max(...nudities.map((entry) => entry.verySuggestive)),
        }
      : null,
    aiGenerated: ai.length ? Math.max(...ai) : null,
  };
}

export function sightengineProvider(apiUser: string, apiSecret: string, env: Env = process.env): ModerationProvider {
  async function call(endpoint: string, bytes: Uint8Array, mime: string, models: string, timeout: number) {
    const form = new FormData();
    form.set("media", new Blob([new Uint8Array(bytes)], { type: mime }), mime.startsWith("video/") ? "media.mp4" : "media");
    form.set("models", models);
    form.set("api_user", apiUser);
    form.set("api_secret", apiSecret);

    const response = await fetch(`https://api.sightengine.com/1.0/${endpoint}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(timeout),
      cache: "no-store",
    }).catch((error: unknown) => {
      throw new ProviderError(`Sightengine injoignable : ${error instanceof Error ? error.name : "erreur"}`);
    });

    const json = (await response.json().catch(() => null)) as
      | ({ status?: string; data?: { frames?: SightengineResult[] } } & SightengineResult)
      | null;

    if (!response.ok || !json || json.status !== "success") {
      throw new ProviderError(`Sightengine a refusé l'analyse (HTTP ${response.status})`);
    }

    return json;
  }

  return {
    name: "sightengine",
    async analyzeImage(bytes, mime) {
      const json = await call("check.json", bytes, mime, env.SIGHTENGINE_IMAGE_MODELS || "nudity-2.1,genai", TIMEOUT_MS);
      return mergeAnalyses("sightengine", [json]);
    },
    async analyzeVideo(bytes, mime) {
      // Analyse synchrone : réservée aux vidéos de moins d'une minute, la limite de Fripe Walk.
      const json = await call("video/check-sync.json", bytes, mime, env.SIGHTENGINE_VIDEO_MODELS || "nudity-2.1,genai", VIDEO_TIMEOUT_MS);
      const frames = json.data?.frames ?? [];
      if (!frames.length) throw new ProviderError("Sightengine n'a renvoyé aucune image analysée");
      return mergeAnalyses("sightengine", frames);
    },
  };
}

// Fournisseur de test : lit un marqueur placé dans le fichier par les tests de bout en bout.
// Refusé hors du stack de test, pour qu'aucun fichier ne puisse s'auto-déclarer sain en production.
const FIXTURE_MARKER = "FRIPE-MODERATION-TEST:";
const FIXTURES: Record<string, SightengineResult> = {
  "explicit-critical": { nudity: { sexual_activity: 0.97 } },
  explicit: { nudity: { sexual_display: 0.6 } },
  erotica: { nudity: { erotica: 0.8 } },
  suggestive: { nudity: { very_suggestive: 0.9 } },
  ai: { nudity: {}, type: { ai_generated: 0.97 } },
};

export function fixtureProvider(): ModerationProvider {
  const analyze = async (bytes: Uint8Array): Promise<ProviderAnalysis> => {
    const text = new TextDecoder("latin1").decode(bytes.subarray(0, 64 * 1024));
    const at = text.indexOf(FIXTURE_MARKER);
    const label = at >= 0 ? text.slice(at + FIXTURE_MARKER.length).match(/^[a-z-]+/)?.[0] ?? "" : "";
    if (label === "unavailable") throw new ProviderError("Fournisseur de test indisponible");
    return mergeAnalyses("fixture", [FIXTURES[label] ?? { nudity: {}, type: { ai_generated: 0.01 } }]);
  };
  return { name: "fixture", analyzeImage: analyze, analyzeVideo: analyze };
}

export function getModerationProvider(env: Env = process.env): ModerationProvider | null {
  const choice = env.MEDIA_MODERATION_PROVIDER?.trim().toLowerCase();

  if (choice === "none") return null;

  if (choice === "fixture") {
    const testStack = env.FRIPE_E2E === "1" || env.NODE_ENV === "test";
    if (!testStack || env.NEXT_PUBLIC_FRIPE_ENV === "production" || env.NEXT_PUBLIC_FRIPE_ENV === "staging") {
      throw new ProviderError("Le fournisseur de modération « fixture » est réservé aux tests.");
    }
    return fixtureProvider();
  }

  if (env.SIGHTENGINE_API_USER && env.SIGHTENGINE_API_SECRET) {
    return sightengineProvider(env.SIGHTENGINE_API_USER, env.SIGHTENGINE_API_SECRET, env);
  }

  return null;
}

// Sans fournisseur, l'envoi est refusé si la modération est exigée (recommandé en production).
export function moderationRequired(env: Env = process.env) {
  return env.MEDIA_MODERATION_REQUIRED === "true";
}
