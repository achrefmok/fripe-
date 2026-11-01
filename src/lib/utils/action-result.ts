import type { z } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields?: Record<string, string> };

export function success(): ActionResult;
export function success<T>(data: T): ActionResult<T>;
export function success(data?: unknown): ActionResult<unknown> {
  return { ok: true, data };
}

export function failure(error: string, fields?: Record<string, string>) {
  return { ok: false as const, error, fields };
}

export function validationFailure(error: z.ZodError) {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".");
    fields[key] ??= issue.message;
  }

  return failure("invalidInput", fields);
}

const KNOWN_RPC_ERRORS = new Set([
  "forbidden",
  "rate_limited",
  "shop_limit_reached",
  "invalid_location",
  "slug_taken",
  "invalid_transition",
  "note_required",
  "not_found",
  "protected_account",
  "product_unavailable",
  "own_product",
  "own_shop",
  "too_many_reservations",
  "too_many_pending_orders",
  "too_many_images",
  "too_many_items",
  "address_required",
  "empty_order",
  "blocked",
  "conversation_closed",
  "message_invalid",
  "already_reported",
  "moderated",
  "shop_not_approved",
  "video_quota_reached",
  "video_missing",
  "video_too_large",
  "video_too_long",
  "too_many_alerts",
  "too_many_outfits",
  "empty_outfit",
  "product_locked",
  "price_changed",
  "invalid_parent",
  "invalid_decision",
  "review_not_allowed",
  "invalid_rating",
  "already_reviewed",
  "already_replied",
  "account_has_active_orders",
]);

// Les RPC lèvent des codes métier stables ; tout le reste reste côté serveur.
export function rpcFailure(error: { message: string; code?: string }) {
  if (KNOWN_RPC_ERRORS.has(error.message)) {
    return failure(error.message);
  }

  console.error("Erreur base de données", { code: error.code });
  return failure("unexpected");
}
