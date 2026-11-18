"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  failure,
  rpcFailure,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/utils/action-result";
import { MAX_IMAGE_BYTES } from "@/features/catalog/constants";
import { detectImageKind } from "@/lib/utils/image-file";
import { createShopSchema, shopIdSchema, shopLocationSchema, updateShopSchema } from "./schemas";


async function requireActiveViewer() {
  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");
  if (viewer.status !== "active") return failure("forbidden");
  return viewer;
}

function revalidateSeller() {
  revalidatePath("/[locale]/vendeur", "layout");
}

export async function createShop(input: unknown): Promise<ActionResult<{ shopId: string }>> {
  const parsed = createShopSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await requireActiveViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_shop", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_description: parsed.data.description,
    p_phone: parsed.data.phone ?? "",
    p_governorate_id: parsed.data.governorateId,
    p_city_id: parsed.data.cityId,
  });

  if (error) {
    return error.message === "slug_taken"
      ? failure("slug_taken", { slug: "slug_taken" })
      : rpcFailure(error);
  }

  revalidateSeller();
  return success({ shopId: data });
}

export async function updateShop(shopId: string, input: unknown): Promise<ActionResult> {
  const id = shopIdSchema.safeParse(shopId);
  if (!id.success) return failure("not_found");

  const parsed = updateShopSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await requireActiveViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shops")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      phone: parsed.data.phone,
      governorate_id: parsed.data.governorateId,
      city_id: parsed.data.cityId,
    })
    .eq("id", id.data)
    .select("id");

  if (error) {
    return error.code === "23503" ? failure("invalid_location") : rpcFailure(error);
  }

  if (!data.length) return failure("forbidden");

  revalidateSeller();
  return success();
}

export async function resubmitShop(shopId: string): Promise<ActionResult> {
  const id = shopIdSchema.safeParse(shopId);
  if (!id.success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_shop", { p_shop_id: id.data });

  if (error) return rpcFailure(error);

  revalidateSeller();
  return success();
}

export async function uploadShopLogo(shopId: string, formData: FormData): Promise<ActionResult> {
  const id = shopIdSchema.safeParse(shopId);
  if (!id.success) return failure("not_found");

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return failure("invalidImage");
  if (file.size > MAX_IMAGE_BYTES) return failure("imageTooLarge");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageKind(bytes);
  if (!kind) return failure("invalidImage");

  const viewer = await requireActiveViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();

  const { data: shop } = await supabase
    .from("shops")
    .select("logo_path")
    .eq("id", id.data)
    .maybeSingle();

  if (!shop) return failure("forbidden");

  const path = `${id.data}/logo-${Date.now()}.${kind.extension}`;
  const storage = supabase.storage.from("shop-assets");

  const { error: uploadError } = await storage.upload(path, bytes, { contentType: kind.mime });
  if (uploadError) {
    console.error("Envoi du logo", { name: uploadError.name });
    return failure("forbidden");
  }

  const { data, error } = await supabase
    .from("shops")
    .update({ logo_path: path })
    .eq("id", id.data)
    .select("id");

  if (error || !data.length) {
    await storage.remove([path]);
    return error ? rpcFailure(error) : failure("forbidden");
  }

  if (shop.logo_path) {
    await storage.remove([shop.logo_path]);
  }

  revalidateSeller();
  return success();
}

// L'adresse principale de la boutique, avec sa position : créée ou remplacée. Les politiques RLS de
// shop_addresses réservent l'écriture au propriétaire et aux gérants d'une boutique modifiable.
export async function saveShopLocation(shopId: string, input: unknown): Promise<ActionResult> {
  const id = shopIdSchema.safeParse(shopId);
  if (!id.success) return failure("not_found");

  const parsed = shopLocationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await requireActiveViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const values = {
    label: "Boutique",
    address_line: parsed.data.addressLine,
    governorate_id: parsed.data.governorateId,
    city_id: parsed.data.cityId,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
  };
  const { data: current, error: readError } = await supabase
    .from("shop_addresses")
    .select("id")
    .eq("shop_id", id.data)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();
  if (readError) return rpcFailure(readError);

  const { data, error } = current
    ? await supabase.from("shop_addresses").update(values).eq("id", current.id).select("id")
    : await supabase.from("shop_addresses").insert({ ...values, shop_id: id.data, is_primary: true }).select("id");

  if (error) return error.code === "23503" ? failure("invalid_location") : rpcFailure(error);
  if (!data.length) return failure("forbidden");

  revalidateSeller();
  revalidatePath("/[locale]/boutique/[slug]", "page");
  return success();
}

export async function removeShopLocation(shopId: string): Promise<ActionResult> {
  const id = shopIdSchema.safeParse(shopId);
  if (!id.success) return failure("not_found");

  const viewer = await requireActiveViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const { error } = await supabase.from("shop_addresses").delete().eq("shop_id", id.data).eq("is_primary", true);
  if (error) return rpcFailure(error);

  revalidateSeller();
  revalidatePath("/[locale]/boutique/[slug]", "page");
  return success();
}
