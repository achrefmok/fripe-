"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, type ActionResult } from "@/lib/utils/action-result";

const idSchema = z.uuid();

export async function reserveProduct(productId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(productId).success) return failure("not_found");
  if (!(await getViewer())) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase.rpc("reserve_product", { p_product_id: productId });

  if (error) return rpcFailure(error);

  revalidatePath(`/[locale]/produit/${productId}`, "page");
  revalidatePath("/[locale]/compte/reservations", "page");
  return success();
}

export async function cancelReservation(reservationId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(reservationId).success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_reservation", { p_reservation_id: reservationId });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/reservations", "page");
  revalidatePath("/[locale]/produit/[productId]", "page");
  revalidatePath("/[locale]/vendeur", "layout");
  return success();
}
