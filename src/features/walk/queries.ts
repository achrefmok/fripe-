import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export const WALK_PAGE_SIZE = 5;

const FEED_COLUMNS =
  "id, description, video_path, thumbnail_path, favorite_count, published_at, shops!inner (id, name, slug, logo_path, cities (name_fr, name_ar)), video_products (position, products (id, title, price_millimes, status, publication_status, product_images (path, position)))";

type RawVideo = {
  id: string;
  description: string | null;
  video_path: string;
  thumbnail_path: string;
  favorite_count: number;
  published_at: string;
  shops: { id: string; name: string; slug: string; logo_path: string | null; cities: { name_fr: string; name_ar: string } | null };
  video_products: {
    position: number;
    products: {
      id: string;
      title: string | null;
      price_millimes: number | null;
      status: string;
      publication_status: string;
      product_images: { path: string; position: number }[];
    } | null;
  }[];
};

function toFeedItem(video: RawVideo) {
  return {
    id: video.id,
    description: video.description,
    videoPath: video.video_path,
    thumbnailPath: video.thumbnail_path,
    favoriteCount: video.favorite_count,
    publishedAt: video.published_at,
    shop: {
      id: video.shops.id,
      name: video.shops.name,
      slug: video.shops.slug,
      logoPath: video.shops.logo_path,
      city: video.shops.cities,
    },
    products: [...video.video_products]
      .sort((a, b) => a.position - b.position)
      .flatMap(({ products: product }) =>
        product?.publication_status === "published" && product.status !== "sold"
          ? [
              {
                id: product.id,
                title: product.title ?? "",
                priceMillimes: product.price_millimes ?? 0,
                imagePath: [...product.product_images].sort((a, b) => a.position - b.position)[0]?.path ?? null,
              },
            ]
          : [],
      ),
  };
}

export type WalkItem = ReturnType<typeof toFeedItem>;

export async function getWalkPage(cursor: string | null, excludeId?: string) {
  const supabase = createPublicClient();

  let query = supabase
    .from("videos")
    .select(FEED_COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .order("id")
    .limit(WALK_PAGE_SIZE + 1);

  if (cursor) query = query.lt("published_at", cursor);
  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data as unknown as RawVideo[];
  const items = rows.slice(0, WALK_PAGE_SIZE).map(toFeedItem);

  return {
    items,
    nextCursor: rows.length > WALK_PAGE_SIZE ? (items.at(-1)?.publishedAt ?? null) : null,
  };
}

export async function getWalkVideo(videoId: string) {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("videos")
    .select(FEED_COLUMNS)
    .eq("id", videoId)
    .eq("status", "published")
    .maybeSingle();

  return data ? toFeedItem(data as unknown as RawVideo) : null;
}

export async function getFavoriteVideoIds(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("video_favorites").select("video_id").eq("user_id", userId);
  return data?.map((row) => row.video_id) ?? [];
}

export async function listShopVideos(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("videos")
    .select(
      "id, description, status, moderated_at, duration_seconds, size_bytes, thumbnail_path, favorite_count, video_products (product_id)",
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}
