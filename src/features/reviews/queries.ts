import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const REVIEW_PAGE_SIZE = 20;

const COLUMNS = "id, author_name, product_title, rating, comment, status, seller_reply, replied_at, created_at";

type ReviewStatus = Database["public"]["Enums"]["review_status"];

export async function listPublicReviews(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(COLUMNS)
    .eq("shop_id", shopId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  return data;
}

export async function listShopReviews(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(COLUMNS)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return data;
}

export async function listAllReviews(status: ReviewStatus, page: number) {
  const supabase = await createClient();
  const from = (page - 1) * REVIEW_PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("reviews")
    .select("id, author_name, product_title, rating, comment, status, seller_reply, replied_at, created_at, shops (name)", { count: "exact" })
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(from, from + REVIEW_PAGE_SIZE - 1);

  if (error) throw error;

  return { reviews: data, total: count ?? 0 };
}

export async function getMyReviews(orderItemIds: string[]) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("my_reviews")
    .select("id, order_item_id, rating, comment, status, seller_reply")
    .in("order_item_id", orderItemIds);

  return new Map(data?.map((review) => [review.order_item_id!, review]));
}
