"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { collectionSchema } from "@/features/catalog/schemas";
import { createClient } from "@/lib/supabase/server";
import {
  failure,
  rpcFailure,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/utils/action-result";

const idSchema = z.uuid();

function revalidateCollections(shopId: string) {
  revalidatePath(`/[locale]/vendeur/boutique/${shopId}`, "layout");
}

export async function createCollection(
  shopId: string,
  input: unknown,
): Promise<ActionResult<{ collectionId: string }>> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .insert({
      shop_id: shopId,
      name: parsed.data.name,
      description: parsed.data.description,
      is_published: parsed.data.isPublished,
    })
    .select("id")
    .single();

  if (error) return error.code === "42501" ? failure("forbidden") : rpcFailure(error);

  revalidateCollections(shopId);
  return success({ collectionId: data.id });
}

export async function updateCollection(
  shopId: string,
  collectionId: string,
  input: unknown,
  productIds: unknown,
): Promise<ActionResult> {
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const ids = z.array(z.uuid()).max(300).safeParse(productIds);
  if (!ids.success || !idSchema.safeParse(collectionId).success) return failure("invalidInput");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      is_published: parsed.data.isPublished,
    })
    .eq("id", collectionId)
    .eq("shop_id", shopId)
    .select("id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  const { error: deleteError } = await supabase
    .from("collection_products")
    .delete()
    .eq("collection_id", collectionId);

  if (deleteError) return rpcFailure(deleteError);

  if (ids.data.length) {
    const { error: insertError } = await supabase.from("collection_products").insert(
      ids.data.map((productId, position) => ({
        collection_id: collectionId,
        product_id: productId,
        position,
      })),
    );

    if (insertError) return rpcFailure(insertError);
  }

  revalidateCollections(shopId);
  return success();
}

export async function deleteCollection(shopId: string, collectionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collectionId)
    .eq("shop_id", shopId)
    .select("id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  revalidateCollections(shopId);
  return success();
}
