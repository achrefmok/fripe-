"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { processStoragePurge } from "@/lib/maintenance";
import { createClient } from "@/lib/supabase/server";
import {
  failure,
  rpcFailure,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/utils/action-result";
import { getViewer } from "@/lib/permissions/viewer";
import { slugify } from "@/lib/utils/slug";
import {
  categorySchema,
  citySchema,
  governorateSchema,
  referenceIdSchema,
  reviewShopSchema,
  userStatusSchema,
} from "./schemas";

// L'autorisation est dans la RPC : `is_platform_admin()` est vérifiée dans la même transaction.
export async function reviewShop(input: unknown): Promise<ActionResult> {
  const parsed = reviewShopSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_shop", {
    p_shop_id: parsed.data.shopId,
    p_status: parsed.data.status,
    p_note: parsed.data.note,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/admin", "layout");
  return success();
}

export async function setUserStatus(input: unknown): Promise<ActionResult> {
  const parsed = userStatusSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_status", {
    p_user_id: parsed.data.userId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/admin", "layout");
  return success();
}

// La politique RLS reste la barrière : ce contrôle donne une erreur claire avant d'écrire.
async function adminClient() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin || viewer.status !== "active" || viewer.aal !== "aal2") return null;
  return createClient();
}

function referenceFailure(error: { code?: string; message: string }) {
  if (error.code === "23505") return failure("slug_taken");
  if (error.code === "23503") return failure("in_use");
  return rpcFailure(error);
}

function revalidateReferences() {
  revalidatePath("/[locale]", "layout");
}

export async function saveCategory(input: unknown): Promise<ActionResult> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");

  const { id, parentId, nameFr, nameAr, position } = parsed.data;
  const values = { parent_id: parentId, name_fr: nameFr, name_ar: nameAr, position };

  const { error } = id
    ? await supabase.from("categories").update(values).eq("id", id)
    : await supabase.from("categories").insert({ ...values, slug: slugify(nameFr) });

  if (error) return referenceFailure(error);

  revalidateReferences();
  return success();
}

export async function setCategoryActive(id: string, active: boolean): Promise<ActionResult> {
  if (!referenceIdSchema.safeParse(id).success) return failure("not_found");

  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");

  const { error } = await supabase.from("categories").update({ is_active: active }).eq("id", id);
  if (error) return referenceFailure(error);

  revalidateReferences();
  return success();
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!referenceIdSchema.safeParse(id).success) return failure("not_found");

  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return referenceFailure(error);

  revalidateReferences();
  return success();
}

export async function saveGovernorate(input: unknown): Promise<ActionResult> {
  const parsed = governorateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");

  const { error } = await supabase
    .from("governorates")
    .update({ name_fr: parsed.data.nameFr, name_ar: parsed.data.nameAr })
    .eq("id", parsed.data.id);

  if (error) return referenceFailure(error);

  revalidateReferences();
  return success();
}

export async function saveCity(input: unknown): Promise<ActionResult> {
  const parsed = citySchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");

  const { id, governorateId, nameFr, nameAr } = parsed.data;

  const { error } = id
    ? await supabase.from("cities").update({ name_fr: nameFr, name_ar: nameAr }).eq("id", id)
    : await supabase
        .from("cities")
        .insert({ governorate_id: governorateId, name_fr: nameFr, name_ar: nameAr, slug: slugify(nameFr) });

  if (error) return referenceFailure(error);

  revalidateReferences();
  return success();
}

export async function setCityActive(id: number, active: boolean): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");

  const { error } = await supabase.from("cities").update({ is_active: active }).eq("id", id);
  if (error) return referenceFailure(error);

  revalidateReferences();
  return success();
}

export async function deleteCity(id: number): Promise<ActionResult> {
  const supabase = await adminClient();
  if (!supabase) return failure("forbidden");

  const { error } = await supabase.from("cities").delete().eq("id", id);
  if (error) return referenceFailure(error);

  revalidateReferences();
  return success();
}

const takedownSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(3, "noteRequired").max(500, "noteTooLong"),
});

export async function emergencyTakedown(shopId: string, reason: string): Promise<ActionResult> {
  const parsed = takedownSchema.safeParse({ id: shopId, reason });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("emergency_takedown", { p_shop_id: parsed.data.id, p_reason: parsed.data.reason });

  if (error) return rpcFailure(error);

  await processStoragePurge().catch(() => console.error("Purge après retrait d'urgence"));

  revalidatePath("/[locale]", "layout");
  return success();
}

export async function moderateVideo(videoId: string, reason: string): Promise<ActionResult> {
  const parsed = takedownSchema.safeParse({ id: videoId, reason });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_video", { p_video_id: parsed.data.id, p_reason: parsed.data.reason });

  if (error) return rpcFailure(error);

  await processStoragePurge().catch(() => console.error("Purge après modération d'une vidéo"));

  revalidatePath("/[locale]/admin/videos", "page");
  revalidatePath("/[locale]/walk", "page");
  return success();
}
