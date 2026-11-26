import "server-only";
import { createClient } from "@/lib/supabase/server";

const ARRIVAL_COLUMNS =
  "id, title, brand, size, condition, price_millimes, status, shops!inner (name, slug, logo_path, governorate_id), product_images (path, position)";

export async function isFollowing(userId: string, shopId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_followers")
    .select("shop_id")
    .eq("user_id", userId)
    .eq("shop_id", shopId)
    .maybeSingle();

  return Boolean(data);
}

export async function listFollowedShops(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_followers")
    .select("shop_id, shops (id, name, slug, follower_count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.flatMap((row) => (row.shops ? [row.shops] : []));
}

export async function getFollowedArrivals(shopIds: string[]) {
  if (!shopIds.length) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(ARRIVAL_COLUMNS)
    .in("shop_id", shopIds)
    .eq("publication_status", "published")
    .in("status", ["available", "reserved"])
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .order("published_at", { ascending: false })
    .limit(24);

  if (error) throw error;

  return data;
}

export async function listNotifications(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, read_at, created_at, product_id, listing_thread_id, media_event_id, products (title, price_millimes), drop_alerts (name), listing_threads (listing_title), media_moderation_events (user_id, category, context, sanction)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data;
}

export async function listAlerts(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drop_alerts")
    .select("id, name, sizes, brands, category_ids, shop_ids, followed_only, max_price_millimes, is_active")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function getPreferences(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("in_app_enabled, max_per_day")
    .eq("user_id", userId)
    .maybeSingle();

  return { inAppEnabled: data?.in_app_enabled ?? true, maxPerDay: data?.max_per_day ?? 10 };
}
