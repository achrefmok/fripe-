"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, validationFailure, type ActionResult } from "@/lib/utils/action-result";
import { getLive, listLiveComments, type Live, type LiveComment } from "./queries";

const idSchema = z.uuid();

const liveSchema = z.object({
  title: z.string().trim().min(3, "nameTooShort").max(80, "nameTooLong"),
  description: z.string().trim().max(500, "textTooLong").optional().default(""),
  // Valeur d'un champ « datetime-local », déjà convertie en ISO par le navigateur, ou vide.
  scheduledAt: z.union([z.iso.datetime({ offset: true }), z.literal("")]).optional().default(""),
  productIds: z.array(z.uuid()).max(30, "live_pieces"),
  coverProductId: z.union([z.uuid(), z.literal("")]).optional().default(""),
});

function revalidateLives(shopId: string, liveId?: string) {
  revalidatePath("/[locale]/lives", "page");
  revalidatePath(`/[locale]/vendeur/boutique/${shopId}/lives`, "page");
  if (liveId) {
    revalidatePath(`/[locale]/lives/${liveId}`, "page");
    revalidatePath(`/[locale]/vendeur/boutique/${shopId}/lives/${liveId}`, "page");
  }
}

// Programmer un Live, ou modifier un Live programmé ou en cours.
export async function saveLive(shopId: string, liveId: string | null, input: unknown): Promise<ActionResult<{ liveId: string }>> {
  if (!idSchema.safeParse(shopId).success || (liveId && !idSchema.safeParse(liveId).success)) return failure("not_found");

  const parsed = liveSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_live", {
    // Les arguments facultatifs de la fonction sont typés sans null par le générateur.
    p_live_id: (liveId ?? null) as unknown as string,
    p_shop_id: shopId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_scheduled_at: (parsed.data.scheduledAt || null) as unknown as string,
    p_product_ids: parsed.data.productIds,
    p_cover_product_id: (parsed.data.coverProductId || null) as unknown as string,
  });

  if (error) return rpcFailure(error);

  revalidateLives(shopId, data);
  return success({ liveId: data });
}

async function transition(rpc: "start_live" | "end_live" | "withdraw_live", shopId: string, liveId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(shopId).success || !idSchema.safeParse(liveId).success) return failure("not_found");

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_live_id: liveId });
  if (error) return rpcFailure(error);

  revalidateLives(shopId, liveId);
  return success();
}

export async function startLive(shopId: string, liveId: string) {
  return transition("start_live", shopId, liveId);
}

export async function endLive(shopId: string, liveId: string) {
  return transition("end_live", shopId, liveId);
}

export async function withdrawLive(shopId: string, liveId: string) {
  return transition("withdraw_live", shopId, liveId);
}

// Mettre une pièce en avant pendant le direct ; null retire la mise en avant.
export async function pinLiveProduct(liveId: string, productId: string | null): Promise<ActionResult> {
  if (!idSchema.safeParse(liveId).success || (productId && !idSchema.safeParse(productId).success)) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("pin_live_product", { p_live_id: liveId, p_product_id: (productId ?? null) as unknown as string });

  return error ? rpcFailure(error) : success();
}

export async function reportLiveViewers(liveId: string, count: number): Promise<void> {
  if (!idSchema.safeParse(liveId).success || !Number.isInteger(count) || count < 0) return;

  const supabase = await createClient();
  await supabase.rpc("report_live_viewers", { p_live_id: liveId, p_count: count });
}

export async function postLiveComment(liveId: string, body: string): Promise<ActionResult<{ id: number }>> {
  if (!idSchema.safeParse(liveId).success) return failure("not_found");

  const text = z.string().trim().min(1, "messageEmpty").max(300, "textTooLong").safeParse(body);
  if (!text.success) return failure(text.error.issues[0]?.message ?? "invalidInput");

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_live_comment", { p_live_id: liveId, p_body: text.data });

  return error ? rpcFailure(error) : success({ id: data });
}

export async function moderateLiveComment(commentId: number, hidden: boolean): Promise<ActionResult> {
  if (!Number.isInteger(commentId) || commentId <= 0) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_live_comment", { p_comment_id: commentId, p_hidden: hidden });

  return error ? rpcFailure(error) : success();
}

// Filet de sécurité du temps réel : l'état du Live et les commentaires arrivés depuis `afterId`.
export async function refreshLive(liveId: string, afterId: number): Promise<{ live: Live | null; comments: LiveComment[] }> {
  if (!idSchema.safeParse(liveId).success || !Number.isInteger(afterId) || afterId < 0) return { live: null, comments: [] };

  const [live, comments] = await Promise.all([getLive(liveId), listLiveComments(liveId, afterId)]);
  return { live, comments };
}
