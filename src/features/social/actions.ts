"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, validationFailure, type ActionResult } from "@/lib/utils/action-result";
import { dropAlertSchema, preferencesSchema } from "./schemas";

const idSchema = z.uuid();

export async function toggleFollow(shopId: string): Promise<ActionResult<{ following: boolean }>> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("shop_followers")
    .delete()
    .eq("user_id", viewer.id)
    .eq("shop_id", shopId)
    .select("shop_id");

  if (error) return rpcFailure(error);

  if (!removed.length) {
    const { error: insertError } = await supabase
      .from("shop_followers")
      .insert({ user_id: viewer.id, shop_id: shopId });

    if (insertError) return rpcFailure(insertError);
  }

  revalidatePath("/[locale]/compte/suivis", "page");
  return success({ following: !removed.length });
}

export async function saveDropAlert(input: unknown): Promise<ActionResult> {
  const parsed = dropAlertSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase.from("drop_alerts").insert({
    user_id: viewer.id,
    name: parsed.data.name,
    sizes: parsed.data.sizes,
    brands: parsed.data.brands,
    category_ids: parsed.data.categoryIds,
    shop_ids: parsed.data.shopIds,
    followed_only: parsed.data.followedOnly,
    max_price_millimes: parsed.data.budget,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/alertes", "page");
  return success();
}

export async function setDropAlertActive(alertId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("drop_alerts")
    .update({ is_active: isActive })
    .eq("id", alertId);

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/alertes", "page");
  return success();
}

export async function deleteDropAlert(alertId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("drop_alerts").delete().eq("id", alertId);

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/alertes", "page");
  return success();
}

export async function savePreferences(input: unknown): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: viewer.id,
    in_app_enabled: parsed.data.inAppEnabled,
    max_per_day: parsed.data.maxPerDay,
  });

  if (error) return rpcFailure(error);

  return success();
}

export async function markNotificationsRead(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", viewer.id)
    .is("read_at", null);

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/notifications", "page");
  return success();
}
