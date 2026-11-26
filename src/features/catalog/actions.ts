"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { processStoragePurge } from "@/lib/maintenance";
import { getViewer } from "@/lib/permissions/viewer";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import {
  failure,
  rpcFailure,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/utils/action-result";
import { detectImageKind } from "@/lib/utils/image-file";
import { moderateMedia } from "@/features/media-moderation/moderate";
import { MAX_CSV_ROWS, MAX_IMAGE_BYTES } from "./constants";
import { validateCsvRows } from "./csv-import";
import { getCategories } from "./queries";
import { bulkPatchSchema, draftRowSchema, productIdsSchema, productSchema } from "./schemas";

const idSchema = z.uuid();

async function activeViewer() {
  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");
  if (viewer.status !== "active") return failure("forbidden");
  return viewer;
}

function revalidateShop(shopId: string) {
  revalidatePath(`/[locale]/vendeur/boutique/${shopId}`, "layout");
}

export async function createProduct(
  shopId: string,
  input: unknown,
): Promise<ActionResult<{ productId: string }>> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const { price, categoryId, ...fields } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...fields,
      reference: fields.reference ?? "",
      shop_id: shopId,
      category_id: categoryId,
      price_millimes: price,
    })
    .select("id")
    .single();

  if (error) return productFailure(error);

  revalidateShop(shopId);
  return success({ productId: data.id });
}

function productFailure(error: { code?: string; message: string }) {
  if (error.code === "23505") return failure("duplicate_reference", { reference: "duplicate_reference" });
  if (error.code === "23514") return failure("product_incomplete");
  if (error.code === "42501") return failure("forbidden");
  return rpcFailure(error);
}

// Prix habituel d'une catégorie : la médiane des pièces en ligne, si au moins trois existent.
// Une indication tirée des vraies annonces, jamais un prix imposé.
export async function getPriceHint(categoryId: unknown): Promise<ActionResult<{ median: number; count: number } | null>> {
  if (!idSchema.safeParse(categoryId).success) return success(null);

  const { data, error } = await createPublicClient()
    .from("products")
    .select("price_millimes")
    .eq("category_id", categoryId as string)
    .eq("publication_status", "published")
    .not("price_millimes", "is", null)
    .order("published_at", { ascending: false })
    .limit(200);

  if (error) return success(null);

  const prices = data.map((row) => row.price_millimes!).sort((a, b) => a - b);
  if (prices.length < 3) return success(null);

  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[middle] : Math.round((prices[middle - 1] + prices[middle]) / 2);
  // Arrondi au demi-dinar : un prix lisible.
  return success({ median: Math.max(500, Math.round(median / 500) * 500), count: prices.length });
}

export async function updateProduct(
  shopId: string,
  productId: string,
  input: unknown,
): Promise<ActionResult> {
  if (!idSchema.safeParse(productId).success) return failure("not_found");

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const { price, categoryId, reference, ...fields } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .update({
      ...fields,
      ...(reference ? { reference } : {}),
      category_id: categoryId,
      price_millimes: price,
    })
    .eq("id", productId)
    .eq("shop_id", shopId)
    .select("id");

  if (error) return productFailure(error);
  if (!data.length) return failure("forbidden");

  revalidateShop(shopId);
  revalidatePath(`/[locale]/produit/${productId}`, "page");
  return success();
}

export async function saveDraftRow(
  shopId: string,
  productId: string,
  input: unknown,
): Promise<ActionResult> {
  if (!idSchema.safeParse(productId).success) return failure("not_found");

  const parsed = draftRowSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ title: parsed.data.title, price_millimes: parsed.data.price })
    .eq("id", productId)
    .eq("shop_id", shopId)
    .select("id");

  if (error) return productFailure(error);
  if (!data.length) return failure("forbidden");

  return success();
}

export async function bulkUpdateProducts(
  shopId: string,
  ids: unknown,
  input: unknown,
): Promise<ActionResult> {
  const parsedIds = productIdsSchema.safeParse(ids);
  if (!parsedIds.success) return failure("invalidInput");

  const parsed = bulkPatchSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const { price, categoryId, condition } = parsed.data;
  const patch = {
    ...(price !== null ? { price_millimes: price } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(condition ? { condition } : {}),
  };

  if (!Object.keys(patch).length) return failure("invalidInput");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .in("id", parsedIds.data)
    .eq("shop_id", shopId)
    .select("id");

  if (error) return productFailure(error);
  if (!data.length) return failure("forbidden");

  revalidateShop(shopId);
  return success();
}

export async function setProductsPublication(
  shopId: string,
  ids: unknown,
  status: "published" | "draft" | "archived",
): Promise<ActionResult<{ problems: { id: string; problem: string }[] }>> {
  const parsedIds = productIdsSchema.safeParse(ids);
  if (!parsedIds.success) return failure("invalidInput");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_products_publication", {
    p_product_ids: parsedIds.data,
    p_status: status,
  });

  if (error) return rpcFailure(error);

  revalidateShop(shopId);
  revalidatePath("/[locale]/catalogue", "page");

  return success({
    problems: data.map((row) => ({ id: row.product_id, problem: row.problem })),
  });
}

export async function setProductAvailability(
  shopId: string,
  productId: string,
  status: "available" | "sold",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_product_availability", {
    p_product_id: productId,
    p_status: status,
  });

  if (error) return rpcFailure(error);

  revalidateShop(shopId);
  return success();
}

async function attachImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  shopId: string,
  productId: string,
  file: FormDataEntryValue | null,
): Promise<ActionResult> {
  if (!(file instanceof File) || file.size === 0) return failure("invalidImage");
  if (file.size > MAX_IMAGE_BYTES) return failure("imageTooLarge");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageKind(bytes);
  if (!kind) return failure("invalidImage");

  // Avant tout stockage : un contenu sexuel n'atteint jamais le bucket public.
  const moderation = await moderateMedia({ userId, context: "product_image", mediaKind: "image", parts: [{ bytes, mime: kind.mime, kind: "image" }] });
  if (!moderation.ok) return failure(moderation.error);

  const { count } = await supabase
    .from("product_images")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  const path = `${shopId}/${productId}/${crypto.randomUUID()}.${kind.extension}`;
  const bucket = supabase.storage.from("product-images");

  const { error: uploadError } = await bucket.upload(path, bytes, { contentType: kind.mime });
  if (uploadError) {
    console.error("Envoi d'image", { name: uploadError.name });
    return failure("forbidden");
  }

  const { error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, path, position: count ?? 0 });

  if (error) {
    await bucket.remove([path]);
    return rpcFailure(error);
  }

  return success();
}

export async function uploadProductImage(
  shopId: string,
  productId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!idSchema.safeParse(productId).success || !idSchema.safeParse(shopId).success) {
    return failure("not_found");
  }

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (!product) return failure("forbidden");

  const result = await attachImage(supabase, viewer.id, shopId, productId, formData.get("image"));
  if (result.ok) revalidateShop(shopId);

  return result;
}

export async function deleteProductImage(
  shopId: string,
  imageId: string,
): Promise<ActionResult> {
  if (!idSchema.safeParse(imageId).success) return failure("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId)
    .select("path");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  await supabase.storage.from("product-images").remove([data[0].path]);

  revalidateShop(shopId);
  return success();
}

// Publication rapide : une photo devient un brouillon à compléter.
export async function createDraftFromPhoto(
  shopId: string,
  formData: FormData,
): Promise<ActionResult> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ shop_id: shopId, reference: "" })
    .select("id")
    .single();

  if (error) return productFailure(error);

  const result = await attachImage(supabase, viewer.id, shopId, data.id, formData.get("image"));
  // Photo refusée (illisible ou bloquée par la modération) : le brouillon vide ne reste pas.
  if (!result.ok) await supabase.from("products").delete().eq("id", data.id);
  return result;
}

export async function importProductsCsv(
  shopId: string,
  rows: unknown,
): Promise<ActionResult<{ created: number; skipped: number }>> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const parsedRows = z
    .array(z.record(z.string(), z.string()))
    .min(1)
    .max(MAX_CSV_ROWS)
    .safeParse(rows);

  if (!parsedRows.success) return failure("csvTooLarge");

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const results = validateCsvRows(parsedRows.data, await getCategories("all"));
  const products = results.flatMap((result) =>
    result.ok ? [{ ...result.product, shop_id: shopId, reference: result.product.reference ?? "" }] : [],
  );

  if (!products.length) return failure("invalidInput");

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert(products);

  if (error) return productFailure(error);

  revalidateShop(shopId);
  return success({ created: products.length, skipped: results.length - products.length });
}

export async function toggleFavorite(productId: string): Promise<ActionResult<{ favorite: boolean }>> {
  if (!idSchema.safeParse(productId).success) return failure("not_found");

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", viewer.id)
    .eq("product_id", productId)
    .select("product_id");

  if (error) return rpcFailure(error);

  if (removed.length) {
    revalidatePath("/[locale]/compte/favoris", "page");
    return success({ favorite: false });
  }

  const { error: insertError } = await supabase
    .from("favorites")
    .insert({ user_id: viewer.id, product_id: productId });

  if (insertError) return rpcFailure(insertError);

  revalidatePath("/[locale]/compte/favoris", "page");
  return success({ favorite: true });
}

export async function moderateProduct(productId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_product", {
    p_product_id: productId,
    p_reason: reason,
  });

  if (error) return rpcFailure(error);

  await processStoragePurge().catch(() => console.error("Purge après modération d'un produit"));

  revalidatePath("/[locale]/admin/produits", "page");
  return success();
}
