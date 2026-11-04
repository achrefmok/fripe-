"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { parsePriceToMillimes } from "@/lib/utils/price";
import {
  failure,
  rpcFailure,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/utils/action-result";
import type { Database } from "@/types/database";
import { cancelOrderSchema, checkoutSchema } from "./schemas";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const idSchema = z.uuid();

function revalidateOrders() {
  revalidatePath("/[locale]/compte/commandes", "layout");
  revalidatePath("/[locale]/vendeur", "layout");
  revalidatePath("/[locale]/admin/commandes", "page");
}

export async function addToCart(productId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(productId).success) return failure("not_found");

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase
    .from("cart_items")
    .upsert({ user_id: viewer.id, product_id: productId }, { ignoreDuplicates: true });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/panier", "page");
  return success();
}

export async function removeFromCart(productId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("user_id", viewer.id)
    .eq("product_id", productId);

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/panier", "page");
  return success();
}

export async function quoteDelivery(
  shopIds: string[],
  governorateId: number,
): Promise<ActionResult<Record<string, number>>> {
  const parsed = z
    .object({ shopIds: z.array(z.uuid()).max(50), governorateId: z.number().int().positive() })
    .safeParse({ shopIds, governorateId });

  if (!parsed.success) return failure("invalidInput");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delivery_quote", {
    p_shop_ids: parsed.data.shopIds,
    p_governorate_id: parsed.data.governorateId,
  });

  if (error) return rpcFailure(error);

  return success(Object.fromEntries(data.map((row) => [row.shop_id, row.fee_millimes])));
}

export async function placeOrder(input: unknown): Promise<ActionResult<{ groupId: string }>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const { data: order } = parsed;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("place_order", {
    p_product_ids: order.productIds,
    p_pickup_shop_ids: order.pickupShopIds,
    p_recipient_name: order.recipientName,
    p_phone: order.phone,
    p_governorate_id: order.governorateId,
    p_city_id: order.cityId,
    p_address_line: order.addressLine,
    p_expected_total: order.expectedTotal as number,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/panier", "page");
  revalidateOrders();
  return success({ groupId: data });
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  if (!idSchema.safeParse(orderId).success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order_status", {
    p_order_id: orderId,
    p_status: status,
  });

  if (error) return rpcFailure(error);

  revalidateOrders();
  return success();
}

export async function cancelOrder(input: unknown): Promise<ActionResult> {
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });

  if (error) return rpcFailure(error);

  revalidateOrders();
  return success();
}

function feeToMillimes(fee: string) {
  return fee.trim() === "0" ? 0 : parsePriceToMillimes(fee);
}


// Grille de la plateforme : un tarif par défaut et, au besoin, un tarif par gouvernorat.
export async function savePlatformDeliveryRates(
  defaultFee: string,
  rates: Record<string, string>,
): Promise<ActionResult> {
  const fallback = feeToMillimes(defaultFee);
  if (fallback === null) return failure("invalidInput", { default: "priceInvalid" });

  const entries: { governorate_id: number; fee_millimes: number }[] = [];
  for (const [governorateId, value] of Object.entries(rates)) {
    if (!value.trim()) continue;
    const fee = feeToMillimes(value);
    if (fee === null) return failure("invalidInput", { [governorateId]: "priceInvalid" });
    entries.push({ governorate_id: Number(governorateId), fee_millimes: fee });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_platform_delivery_rates", {
    p_default_millimes: fallback,
    p_rates: entries,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/admin/livraison", "page");
  return success();
}
