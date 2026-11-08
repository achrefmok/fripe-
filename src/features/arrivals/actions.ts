"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, validationFailure, type ActionResult } from "@/lib/utils/action-result";

const idSchema = z.uuid();

const arrivalSchema = z.object({
  title: z.string().trim().min(3, "arrivalTitleShort").max(80, "nameTooLong"),
  note: z.string().trim().max(300, "textTooLong").optional().default(""),
  productIds: z.array(z.uuid()).min(1, "arrival_pieces").max(12, "arrival_pieces"),
});

function revalidateArrivals(shopId?: string) {
  revalidatePath("/[locale]", "page");
  revalidatePath("/[locale]/admin/arrivages", "page");
  if (shopId) revalidatePath(`/[locale]/vendeur/boutique/${shopId}/arrivages`, "page");
}

// La boutique annonce un arrivage : il attend la validation de l'administration.
export async function submitArrival(shopId: string, input: unknown): Promise<ActionResult<{ arrivalId: string }>> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const parsed = arrivalSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_arrival", {
    p_shop_id: shopId,
    p_title: parsed.data.title,
    p_note: parsed.data.note,
    p_product_ids: parsed.data.productIds,
  });

  if (error) return rpcFailure(error);

  revalidateArrivals(shopId);
  return success({ arrivalId: data });
}

export async function withdrawArrival(shopId: string, arrivalId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(arrivalId).success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_arrival", { p_arrival_id: arrivalId });
  if (error) return rpcFailure(error);

  revalidateArrivals(shopId);
  return success();
}

export async function reviewArrival(arrivalId: string, status: "approved" | "rejected", note: string): Promise<ActionResult> {
  if (!idSchema.safeParse(arrivalId).success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_arrival", { p_arrival_id: arrivalId, p_status: status, p_note: note });
  if (error) return rpcFailure(error);

  revalidateArrivals();
  return success();
}
