"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, validationFailure, type ActionResult } from "@/lib/utils/action-result";

const reviewSchema = z.object({
  orderItemId: z.uuid(),
  rating: z.number().int().min(1, "ratingRequired").max(5, "ratingRequired"),
  comment: z.string().trim().max(1000, "textTooLong"),
});

const replySchema = z.object({
  reviewId: z.uuid(),
  reply: z.string().trim().min(2, "noteRequired").max(1000, "textTooLong"),
});

const moderationSchema = z.object({
  reviewId: z.uuid(),
  status: z.enum(["published", "hidden"]),
  note: z.string().trim().min(3, "noteRequired").max(500, "noteTooLong"),
});

export async function createReview(input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  if (!(await getViewer())) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_review", {
    p_order_item_id: parsed.data.orderItemId,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/commandes", "layout");
  revalidatePath("/[locale]/boutique/[slug]", "page");
  return success();
}

export async function replyToReview(input: unknown): Promise<ActionResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_review", {
    p_review_id: parsed.data.reviewId,
    p_reply: parsed.data.reply,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/vendeur", "layout");
  revalidatePath("/[locale]/boutique/[slug]", "page");
  return success();
}

export async function moderateReview(input: unknown): Promise<ActionResult> {
  const parsed = moderationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_review", {
    p_review_id: parsed.data.reviewId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/admin/avis", "page");
  revalidatePath("/[locale]/boutique/[slug]", "page");
  return success();
}
