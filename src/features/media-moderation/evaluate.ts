import { detectAiProvenance } from "./ai-provenance";
import {
  aiSignalsFrom,
  decide,
  worst,
  type AiSignal,
  type MediaContext,
  type MediaKind,
  type ProviderAnalysis,
  type Verdict,
} from "./policy";
import { ProviderError, type ModerationProvider } from "./providers";

export type MediaPart = { bytes: Uint8Array; mime: string; kind: MediaKind };

export type ModerationEvent = {
  userId: string;
  mediaKind: MediaKind;
  context: MediaContext;
  decision: "block" | "flag";
  category: string;
  severity: string;
  reason: string;
  scores: Record<string, unknown>;
  aiSignals: AiSignal[];
  provider: string;
  sha256: string;
};

export type ModerationOutcome =
  | { ok: true; flagged: boolean }
  | { ok: false; error: "media_blocked" | "media_blocked_suspended" | "moderation_unavailable" };

export type ModerationDeps = {
  provider: ModerationProvider | null;
  required: boolean;
  // Enregistre l'événement, applique la sanction et prévient les administrateurs (côté base).
  record: (event: ModerationEvent) => Promise<{ suspended: boolean }>;
  log?: (message: string, details?: Record<string, unknown>) => void;
};

export async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Analyse chaque partie d'un envoi (une image, ou une vidéo et sa miniature) et garde le pire verdict.
// Une panne du fournisseur bloque l'envoi : on ne publie pas ce que l'on n'a pas pu vérifier.
export async function evaluateMedia(parts: MediaPart[], provider: ModerationProvider | null) {
  const results: { verdict: Verdict; signals: AiSignal[]; analysis: ProviderAnalysis | null; kind: MediaKind }[] = [];

  for (const part of parts) {
    const provenance = detectAiProvenance(part.bytes);
    const analysis = provider
      ? part.kind === "video"
        ? await provider.analyzeVideo(part.bytes, part.mime)
        : await provider.analyzeImage(part.bytes, part.mime)
      : null;
    const signals = aiSignalsFrom(analysis, provenance);
    results.push({ verdict: decide(analysis, signals), signals, analysis, kind: part.kind });
  }

  return {
    verdict: worst(results.map((result) => result.verdict)),
    signals: results.flatMap((result) => result.signals),
    analyses: results.map((result) => ({ kind: result.kind, provider: result.analysis?.provider ?? null, nudity: result.analysis?.nudity ?? null, aiGenerated: result.analysis?.aiGenerated ?? null })),
  };
}

export async function runModeration(
  input: { userId: string; context: MediaContext; mediaKind: MediaKind; parts: MediaPart[] },
  deps: ModerationDeps,
): Promise<ModerationOutcome> {
  const log = deps.log ?? ((message, details) => console.error(message, details));

  if (!deps.provider && deps.required) {
    log("Modération des médias exigée mais aucun fournisseur configuré");
    return { ok: false, error: "moderation_unavailable" };
  }

  let evaluation: Awaited<ReturnType<typeof evaluateMedia>>;
  try {
    evaluation = await evaluateMedia(input.parts, deps.provider);
  } catch (error) {
    log("Modération des médias indisponible", { name: error instanceof ProviderError ? error.message : error instanceof Error ? error.name : "erreur" });
    return { ok: false, error: "moderation_unavailable" };
  }

  const { verdict } = evaluation;
  if (verdict.decision === "allow") return { ok: true, flagged: false };

  let suspended = false;
  try {
    const recorded = await deps.record({
      userId: input.userId,
      mediaKind: input.mediaKind,
      context: input.context,
      decision: verdict.decision,
      category: verdict.category,
      severity: verdict.severity,
      reason: verdict.reason,
      scores: { parts: evaluation.analyses },
      aiSignals: evaluation.signals,
      provider: deps.provider?.name ?? "provenance",
      sha256: await sha256(input.parts[0].bytes),
    });
    suspended = recorded.suspended;
  } catch (error) {
    // Le blocage tient même si le rapport n'a pas pu être enregistré.
    log("Rapport de modération non enregistré", { name: error instanceof Error ? error.message : "erreur" });
  }

  if (verdict.decision === "flag") return { ok: true, flagged: true };
  return { ok: false, error: suspended ? "media_blocked_suspended" : "media_blocked" };
}
