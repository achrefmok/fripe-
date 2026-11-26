import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { runModeration, type MediaPart, type ModerationEvent, type ModerationOutcome } from "./evaluate";
import type { MediaContext, MediaKind } from "./policy";
import { getModerationProvider, moderationRequired, type ModerationProvider } from "./providers";

// Le rapport, la sanction et la notification des administrateurs passent par une fonction réservée
// à la clé secrète : un compte ne peut ni écrire son propre rapport ni s'éviter la suspension.
async function recordEvent(event: ModerationEvent) {
  const { data, error } = await createAdminClient().rpc("record_media_moderation", {
    p_user_id: event.userId,
    p_media_kind: event.mediaKind,
    p_context: event.context,
    p_decision: event.decision,
    p_category: event.category,
    p_severity: event.severity,
    p_reason: event.reason,
    p_scores: event.scores as never,
    p_ai_signals: event.aiSignals as never,
    p_provider: event.provider,
    p_sha256: event.sha256,
  });

  if (error) throw new Error(`record_media_moderation : ${error.code ?? error.message}`);
  return { suspended: Boolean((data as { suspended?: boolean } | null)?.suspended) };
}

function provider(): ModerationProvider | null | "misconfigured" {
  try {
    return getModerationProvider();
  } catch (error) {
    console.error("Modération des médias mal configurée", { message: error instanceof Error ? error.message : "erreur" });
    return "misconfigured";
  }
}

// Le point d'entrée unique, appelé par chaque envoi de média avant son stockage.
export async function moderateMedia(input: {
  userId: string;
  context: MediaContext;
  mediaKind: MediaKind;
  parts: MediaPart[];
}): Promise<ModerationOutcome> {
  const chosen = provider();
  if (chosen === "misconfigured") return { ok: false, error: "moderation_unavailable" };

  return runModeration(input, { provider: chosen, required: moderationRequired(), record: recordEvent });
}
