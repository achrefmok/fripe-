import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { productImageUrl } from "@/lib/utils/storage";
import type { Database } from "@/types/database";

export type LiveStatus = Database["public"]["Enums"]["live_status"];

const LIVE_COLUMNS =
  "id, shop_id, title, description, status, scheduled_at, started_at, ended_at, cover_product_id, pinned_product_id, viewer_peak, comment_count, created_at, shops!inner (id, name, slug, logo_path, cities (name_fr, name_ar)), live_products (position, products (id, title, brand, size, condition, price_millimes, status, publication_status, product_images (path, position)))";

type RawLive = {
  id: string;
  shop_id: string;
  title: string;
  description: string;
  status: LiveStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  cover_product_id: string | null;
  pinned_product_id: string | null;
  viewer_peak: number;
  comment_count: number;
  created_at: string;
  shops: { id: string; name: string; slug: string; logo_path: string | null; cities: { name_fr: string; name_ar: string } | null };
  live_products: {
    position: number;
    products: {
      id: string;
      title: string | null;
      brand: string | null;
      size: string | null;
      condition: Database["public"]["Enums"]["product_condition"] | null;
      price_millimes: number | null;
      status: Database["public"]["Enums"]["product_status"];
      publication_status: Database["public"]["Enums"]["publication_status"];
      product_images: { path: string; position: number }[];
    } | null;
  }[];
};

export type LiveProduct = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: Database["public"]["Enums"]["product_condition"] | null;
  priceMillimes: number;
  available: boolean;
  imageUrl: string | null;
};

function toLive(row: RawLive) {
  const products: LiveProduct[] = [...row.live_products]
    .sort((a, b) => a.position - b.position)
    .flatMap(({ products: product }) => {
      if (!product || product.publication_status !== "published") return [];
      const image = [...product.product_images].sort((a, b) => a.position - b.position)[0];
      return [
        {
          id: product.id,
          title: product.title ?? "",
          brand: product.brand,
          size: product.size,
          condition: product.condition,
          priceMillimes: product.price_millimes ?? 0,
          available: product.status === "available",
          imageUrl: image ? productImageUrl(image.path) : null,
        },
      ];
    });

  const cover = products.find((product) => product.id === row.cover_product_id) ?? products[0];

  return {
    id: row.id,
    shopId: row.shop_id,
    title: row.title,
    description: row.description,
    status: row.status,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    coverProductId: row.cover_product_id,
    pinnedProductId: row.pinned_product_id,
    viewerPeak: row.viewer_peak,
    commentCount: row.comment_count,
    coverUrl: cover?.imageUrl ?? null,
    shop: { id: row.shops.id, name: row.shops.name, slug: row.shops.slug, logoPath: row.shops.logo_path, city: row.shops.cities },
    products,
  };
}

export type Live = ReturnType<typeof toLive>;

export type LiveComment = {
  id: number;
  authorName: string;
  body: string;
  hidden: boolean;
  createdAt: string;
};

// La page des Lives : ce qui est en direct, ce qui est programmé, ce qui vient de se terminer.
export async function listPublicLives() {
  const supabase = createPublicClient();
  const [current, ended] = await Promise.all([
    supabase.from("lives").select(LIVE_COLUMNS).in("status", ["live", "scheduled"]).order("scheduled_at", { ascending: true, nullsFirst: true }).limit(40),
    supabase.from("lives").select(LIVE_COLUMNS).eq("status", "ended").order("ended_at", { ascending: false }).limit(8),
  ]);

  if (current.error) throw current.error;
  if (ended.error) throw ended.error;

  const lives = (current.data as unknown as RawLive[]).map(toLive);

  return {
    live: lives.filter((live) => live.status === "live"),
    scheduled: lives.filter((live) => live.status === "scheduled"),
    ended: (ended.data as unknown as RawLive[]).map(toLive),
  };
}

// Lu avec la session : la boutique voit aussi ses Lives annulés.
export async function getLive(liveId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lives").select(LIVE_COLUMNS).eq("id", liveId).maybeSingle();

  if (error) throw error;
  return data ? toLive(data as unknown as RawLive) : null;
}

export async function listShopLives(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lives").select(LIVE_COLUMNS).eq("shop_id", shopId).order("created_at", { ascending: false }).limit(40);

  if (error) throw error;
  return (data as unknown as RawLive[]).map(toLive);
}

export async function listLiveComments(liveId: string, afterId = 0): Promise<LiveComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("live_comments")
    .select("id, author_name, body, hidden_at, created_at")
    .eq("live_id", liveId)
    .gt("id", afterId)
    .order("id", { ascending: false })
    .limit(80);

  if (error) throw error;

  return data
    .map((row) => ({ id: row.id, authorName: row.author_name, body: row.body, hidden: Boolean(row.hidden_at), createdAt: row.created_at }))
    .reverse();
}

// Les pièces qu'une boutique peut présenter : en ligne et encore disponibles.
export async function listLiveCandidates(shopId: string): Promise<LiveProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, title, brand, size, condition, price_millimes, status, product_images (path, position)")
    .eq("shop_id", shopId)
    .eq("publication_status", "published")
    .in("status", ["available", "reserved"])
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .order("published_at", { ascending: false })
    .limit(120);

  if (error) throw error;

  return data.map((product) => ({
    id: product.id,
    title: product.title ?? "",
    brand: product.brand,
    size: product.size,
    condition: product.condition,
    priceMillimes: product.price_millimes ?? 0,
    available: product.status === "available",
    imageUrl: product.product_images[0] ? productImageUrl(product.product_images[0].path) : null,
  }));
}

// Les ventes d'un Live : les pièces présentées, commandées depuis le début du direct et jusqu'à
// deux heures après sa fin. La RLS limite la lecture aux commandes de la boutique.
export async function getLiveSales(live: Pick<Live, "shopId" | "startedAt" | "endedAt" | "products">) {
  if (!live.startedAt || !live.products.length) return { pieces: 0, revenueMillimes: 0 };

  const supabase = await createClient();
  const until = live.endedAt ? new Date(new Date(live.endedAt).getTime() + 2 * 60 * 60 * 1000).toISOString() : null;

  let query = supabase
    .from("order_items")
    .select("price_millimes, orders!inner (shop_id, status, created_at)")
    .in("product_id", live.products.map((product) => product.id))
    .eq("orders.shop_id", live.shopId)
    .neq("orders.status", "cancelled")
    .gte("orders.created_at", live.startedAt);

  if (until) query = query.lte("orders.created_at", until);

  const { data, error } = await query;
  if (error) throw error;

  return { pieces: data.length, revenueMillimes: data.reduce((sum, item) => sum + item.price_millimes, 0) };
}
