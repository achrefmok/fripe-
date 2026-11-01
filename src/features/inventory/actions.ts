"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  failure,
  rpcFailure,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/utils/action-result";
import { inventoryItemSchema, offerSchema, stockRequestSchema } from "./schemas";

const idSchema = z.uuid();

function revalidateShop(shopId: string) {
  revalidatePath(`/[locale]/vendeur/boutique/${shopId}`, "layout");
}

export async function addInventoryItem(shopId: string, input: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert({
    shop_id: shopId,
    category_id: parsed.data.categoryId,
    label: parsed.data.label || null,
    approx_quantity: parsed.data.approxQuantity,
  });

  if (error) return error.code === "42501" ? failure("forbidden") : rpcFailure(error);

  revalidateShop(shopId);
  return success();
}

export async function updateInventoryItem(
  shopId: string,
  itemId: string,
  patch: { approxQuantity?: number; isVisible?: boolean },
): Promise<ActionResult> {
  const parsed = z
    .object({
      approxQuantity: z.number().int().min(0).max(1000000).optional(),
      isVisible: z.boolean().optional(),
    })
    .safeParse(patch);

  if (!parsed.success) return failure("quantityInvalid");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .update({
      ...(parsed.data.approxQuantity !== undefined
        ? { approx_quantity: parsed.data.approxQuantity }
        : {}),
      ...(parsed.data.isVisible !== undefined ? { is_visible: parsed.data.isVisible } : {}),
    })
    .eq("id", itemId)
    .eq("shop_id", shopId)
    .select("id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  revalidateShop(shopId);
  return success();
}

export async function deleteInventoryItem(shopId: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId)
    .eq("shop_id", shopId)
    .select("id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  revalidateShop(shopId);
  return success();
}

export async function createStockRequest(shopId: string, input: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const parsed = stockRequestSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_stock_request", {
    p_shop_id: shopId,
    p_category_id: (parsed.data.categoryId || null) as string,
    p_size: parsed.data.size,
    p_color: parsed.data.color,
    p_brand: parsed.data.brand,
    p_budget_millimes: parsed.data.budget,
    p_message: parsed.data.message,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/demandes", "page");
  return success();
}

export async function offerProduct(shopId: string, input: unknown): Promise<ActionResult> {
  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("offer_product", {
    p_request_id: parsed.data.requestId,
    p_product_id: parsed.data.productId,
    p_message: parsed.data.message,
  });

  if (error) return rpcFailure(error);

  revalidateShop(shopId);
  return success();
}

export async function closeStockRequest(requestId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(requestId).success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_stock_request", { p_request_id: requestId });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/demandes", "page");
  revalidatePath("/[locale]/vendeur", "layout");
  return success();
}
