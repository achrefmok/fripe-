import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

const ITEM_COLUMNS =
  "id, label, approx_quantity, is_visible, last_counted_at, category_id, categories (name_fr, name_ar)";

export async function listInventory(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select(ITEM_COLUMNS)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function listPublicInventory(shopId: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select(ITEM_COLUMNS)
    .eq("shop_id", shopId)
    .eq("is_visible", true)
    .gt("approx_quantity", 0)
    .order("approx_quantity", { ascending: false });

  if (error) throw error;

  return data;
}

const REQUEST_COLUMNS =
  "id, client_id, client_name, size, color, brand, budget_millimes, message, status, created_at, shops (id, name, slug), categories (name_fr, name_ar), stock_request_offers (id, message, product_id, products (title, price_millimes, status))";

export async function listShopRequests(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_requests")
    .select(REQUEST_COLUMNS)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return data;
}

export async function listMyRequests(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_requests")
    .select(REQUEST_COLUMNS)
    .eq("client_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return data;
}
