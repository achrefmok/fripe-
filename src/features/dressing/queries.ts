import "server-only";
import { getCategories, searchTokens } from "@/features/catalog/queries";
import { MARKET_PAGE_SIZE, type MarketFilters } from "@/features/marketplace/schemas";
import { createPublicClient } from "@/lib/supabase/public";
import { parsePriceToMillimes } from "@/lib/utils/price";
import { listingImageUrl } from "@/lib/utils/storage";
import type { Database } from "@/types/database";

type Condition = Database["public"]["Enums"]["product_condition"];

const CARD_COLUMNS =
  "id, seller_id, seller_name, title, brand, size, condition, price_millimes, status, favorite_count, published_at, category_id, governorates (name_fr, name_ar), listing_images (path, position)";

type Row = {
  id: string;
  seller_id: string;
  seller_name: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: Condition;
  price_millimes: number;
  status: Database["public"]["Enums"]["product_status"];
  favorite_count: number;
  published_at: string | null;
  category_id: string;
  governorates: { name_fr: string; name_ar: string } | null;
  listing_images: { path: string; position: number }[];
};

export type DressingItem = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: Condition;
  priceMillimes: number;
  reserved: boolean;
  imageUrl: string | null;
  sellerId: string;
  sellerName: string;
  favoriteCount: number;
};

export type DressingPreview = {
  sellerId: string;
  sellerName: string;
  place: { name_fr: string; name_ar: string } | null;
  count: number;
  brands: string[];
  previews: string[];
};

function toItem(row: Row): DressingItem {
  const image = [...row.listing_images].sort((a, b) => a.position - b.position)[0];

  return {
    id: row.id,
    title: row.title,
    brand: row.brand?.trim() || null,
    size: row.size?.trim() || null,
    condition: row.condition,
    priceMillimes: row.price_millimes,
    reserved: row.status === "reserved",
    imageUrl: image ? listingImageUrl(image.path) : null,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    favoriteCount: row.favorite_count,
  };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

// Les annonces visibles du Vide-Dressing : la RLS écarte déjà les annonces masquées ou modérées.
function visibleListings(columns: string, count = false) {
  return createPublicClient()
    .from("listings")
    .select(columns, count ? { count: "exact" } : undefined)
    .eq("section", "vide_dressing")
    .eq("publication_status", "published")
    .neq("status", "sold")
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" });
}

// Une catégorie racine englobe ses sous-catégories, comme dans le catalogue mode.
function categoryScope(categories: Awaited<ReturnType<typeof getCategories>>, slug: string) {
  const selected = categories.find((category) => category.slug === slug);
  if (!selected) return null;

  const root = categories.find((category) => category.id === selected.parentId) ?? selected;
  const ids = categories
    .filter((category) => category.id === selected.id || category.parentId === selected.id)
    .map((category) => category.id);

  return { selected, root, ids };
}

export async function searchDressing(filters: MarketFilters) {
  const categories = await getCategories("mode");
  const scope = filters.categorie ? categoryScope(categories, filters.categorie) : null;

  let query = visibleListings(CARD_COLUMNS, true);

  if (filters.categorie) query = query.in("category_id", scope?.ids ?? []);
  for (const token of searchTokens(filters.q)) query = query.ilike("search_text", `%${escapeLike(token)}%`);
  if (filters.etat) query = query.eq("condition", filters.etat);
  if (filters.gouvernorat) query = query.eq("governorate_id", Number(filters.gouvernorat) || 0);
  if (filters.marque) query = query.ilike("brand", escapeLike(filters.marque));
  if (filters.taille) query = query.ilike("size", escapeLike(filters.taille));

  const minimum = parsePriceToMillimes(filters.prixMin);
  const maximum = parsePriceToMillimes(filters.prixMax);
  if (minimum !== null) query = query.gte("price_millimes", minimum);
  if (maximum !== null) query = query.lte("price_millimes", maximum);

  query =
    filters.tri === "recent"
      ? query.order("published_at", { ascending: false })
      : query.order("price_millimes", { ascending: filters.tri === "price_asc" });

  const from = (filters.page - 1) * MARKET_PAGE_SIZE;
  const { data, count, error } = await query.order("id").range(from, from + MARKET_PAGE_SIZE - 1);
  if (error) throw error;

  return { items: (data as unknown as Row[]).map(toItem), total: count ?? 0, categories, scope };
}

function topValues(values: (string | null)[], limit: number) {
  const counts = new Map<string, { label: string; count: number }>();

  for (const value of values) {
    const label = value?.trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase();
    const entry = counts.get(key) ?? { label, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

const FINE_CONDITIONS: Condition[] = ["new_with_tags", "like_new", "very_good"];

// La vitrine du Vide-Dressing, calculée sur les annonces les plus récentes : les dressings à
// découvrir, les marques et les tailles présentes, les bonnes occasions et les pièces de marque.
export async function getDressingOverview() {
  const { data, error } = await visibleListings(CARD_COLUMNS).order("published_at", { ascending: false }).limit(200);
  if (error) throw error;

  const rows = data as unknown as Row[];
  const bySeller = new Map<string, Row[]>();
  for (const row of rows) bySeller.set(row.seller_id, [...(bySeller.get(row.seller_id) ?? []), row]);

  const dressings: DressingPreview[] = [...bySeller.entries()]
    .map(([sellerId, list]) => ({
      sellerId,
      sellerName: list[0].seller_name,
      place: list[0].governorates,
      count: list.length,
      brands: topValues(list.map((row) => row.brand), 3).map((brand) => brand.label),
      previews: list.flatMap((row) => toItem(row).imageUrl ?? []).slice(0, 3),
    }))
    .filter((dressing) => dressing.previews.length)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const items = rows.map(toItem);

  return {
    dressings,
    brands: topValues(rows.map((row) => row.brand), 12),
    sizes: topValues(rows.map((row) => row.size), 10),
    latest: items.slice(0, 3),
    deals: items
      .filter((item) => FINE_CONDITIONS.includes(item.condition) && item.imageUrl)
      .sort((a, b) => a.priceMillimes - b.priceMillimes)
      .slice(0, 8),
    branded: items
      .filter((item) => item.brand && item.imageUrl)
      .sort((a, b) => b.favoriteCount - a.favoriteCount)
      .slice(0, 8),
  };
}

// Le dressing d'une personne : toutes ses pièces en vente.
export async function getDressing(sellerId: string) {
  const { data, error } = await visibleListings(CARD_COLUMNS)
    .eq("seller_id", sellerId)
    .order("published_at", { ascending: false })
    .limit(120);
  if (error) throw error;

  const rows = data as unknown as Row[];
  if (!rows.length) return null;

  return {
    sellerId,
    sellerName: rows[0].seller_name,
    place: rows[0].governorates,
    brands: topValues(rows.map((row) => row.brand), 6).map((brand) => brand.label),
    items: rows.map(toItem),
  };
}

// Autour d'une annonce : le reste du même dressing, puis des pièces proches chez d'autres personnes
// (même marque d'abord, même catégorie ensuite).
export async function getAroundListing(listing: { id: string; sellerId: string; categoryId: string; brand: string | null }) {
  const same = visibleListings(CARD_COLUMNS)
    .eq("seller_id", listing.sellerId)
    .neq("id", listing.id)
    .order("published_at", { ascending: false })
    .limit(6);

  const category = visibleListings(CARD_COLUMNS)
    .eq("category_id", listing.categoryId)
    .neq("seller_id", listing.sellerId)
    .order("published_at", { ascending: false })
    .limit(8);

  const brand = listing.brand?.trim()
    ? visibleListings(CARD_COLUMNS)
        .ilike("brand", escapeLike(listing.brand.trim()))
        .neq("seller_id", listing.sellerId)
        .order("published_at", { ascending: false })
        .limit(8)
    : null;

  const [sameResult, categoryResult, brandResult] = await Promise.all([same, category, brand]);
  if (sameResult.error) throw sameResult.error;
  if (categoryResult.error) throw categoryResult.error;
  if (brandResult?.error) throw brandResult.error;

  const similar = new Map<string, DressingItem>();
  for (const row of [...((brandResult?.data ?? []) as unknown as Row[]), ...(categoryResult.data as unknown as Row[])]) {
    if (!similar.has(row.id)) similar.set(row.id, toItem(row));
  }

  return {
    sameDressing: (sameResult.data as unknown as Row[]).map(toItem),
    similar: [...similar.values()].slice(0, 8),
  };
}
