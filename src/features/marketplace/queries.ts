import "server-only";
import { getCategories, searchTokens } from "@/features/catalog/queries";
import { categoryScope } from "@/features/catalog/category-scope";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { parsePriceToMillimes } from "@/lib/utils/price";
import { listingImageUrl, productImageUrl } from "@/lib/utils/storage";
import type { Database } from "@/types/database";
import { MARKET_PAGE_SIZE, type ListingSection, type MarketFilters } from "./schemas";

type Condition = Database["public"]["Enums"]["product_condition"];

export type MarketItem = {
  kind: "listing" | "product";
  id: string;
  title: string;
  priceMillimes: number;
  condition: Condition | null;
  reserved: boolean;
  imageUrl: string | null;
  sellerType: "particulier" | "pro";
  sellerName: string;
  shopLogoPath: string | null;
  href: string;
};

export type CategoryAttribute = {
  categoryId: string;
  key: string;
  labelFr: string;
  labelAr: string;
  kind: "choice" | "text";
  options: { value: string; fr: string; ar: string }[];
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

// La Marketplace a ses rubriques ; le Vide-Dressing reprend celles de la mode.
export function sectionCategories(section: ListingSection) {
  return getCategories(section === "vide_dressing" ? "mode" : "marketplace");
}

export async function getCategoryAttributes(categoryIds: string[]): Promise<CategoryAttribute[]> {
  if (!categoryIds.length) return [];

  const { data, error } = await createPublicClient()
    .from("category_attributes")
    .select("category_id, key, label_fr, label_ar, kind, options")
    .in("category_id", categoryIds)
    .order("position");

  if (error) throw error;

  return data.map((row) => ({
    categoryId: row.category_id,
    key: row.key,
    labelFr: row.label_fr,
    labelAr: row.label_ar,
    kind: row.kind as CategoryAttribute["kind"],
    options: row.options as CategoryAttribute["options"],
  }));
}

// Une catégorie racine englobe ses sous-catégories, comme dans le catalogue mode.
// La portée d'un filtre de catégorie est partagée avec le catalogue : voir category-scope.ts.

export async function searchMarketplace(filters: MarketFilters) {
  const categories = await getCategories("marketplace");
  const scope = filters.categorie ? categoryScope(categories, filters.categorie) : null;

  let query = createPublicClient()
    .from("marketplace_items")
    .select(
      "kind, id, title, price_millimes, condition, status, seller_type, seller_name, shop_logo_path, image_path",
      { count: "exact" },
    );

  if (filters.categorie) query = query.in("category_id", scope?.ids ?? []);
  for (const token of searchTokens(filters.q)) query = query.ilike("search_text", `%${escapeLike(token)}%`);
  if (filters.etat) query = query.eq("condition", filters.etat);
  if (filters.vendeur) query = query.eq("seller_type", filters.vendeur);
  if (filters.gouvernorat) query = query.eq("governorate_id", Number(filters.gouvernorat) || 0);

  const minimum = parsePriceToMillimes(filters.prixMin);
  const maximum = parsePriceToMillimes(filters.prixMax);
  if (minimum !== null) query = query.gte("price_millimes", minimum);
  if (maximum !== null) query = query.lte("price_millimes", maximum);

  for (const [key, value] of Object.entries(filters.attributes)) {
    query = query.ilike(`attributes->>${key}`, escapeLike(value));
  }

  query =
    filters.tri === "recent"
      ? query.order("published_at", { ascending: false })
      : query.order("price_millimes", { ascending: filters.tri === "price_asc" });

  const from = (filters.page - 1) * MARKET_PAGE_SIZE;
  const { data, count, error } = await query.order("id").range(from, from + MARKET_PAGE_SIZE - 1);
  if (error) throw error;

  const items: MarketItem[] = data.map((row) => ({
    kind: row.kind === "product" ? "product" : "listing",
    id: row.id!,
    title: row.title ?? "",
    priceMillimes: row.price_millimes ?? 0,
    condition: row.condition,
    reserved: row.status === "reserved",
    imageUrl: row.image_path
      ? row.kind === "product"
        ? productImageUrl(row.image_path)
        : listingImageUrl(row.image_path)
      : null,
    sellerType: row.seller_type === "pro" ? "pro" : "particulier",
    sellerName: row.seller_name ?? "",
    shopLogoPath: row.shop_logo_path,
    href: row.kind === "product" ? `/produit/${row.id}` : `/annonce/${row.id}`,
  }));

  return { items, total: count ?? 0, categories, scope };
}

const LISTING_CARD_COLUMNS =
  "id, title, price_millimes, condition, status, seller_name, listing_images (path, position)";

type ListingCardRow = {
  id: string;
  title: string;
  price_millimes: number;
  condition: Condition;
  status: Database["public"]["Enums"]["product_status"];
  seller_name: string;
  listing_images: { path: string; position: number }[];
};

function listingCard(row: ListingCardRow): MarketItem {
  const image = [...row.listing_images].sort((a, b) => a.position - b.position)[0];

  return {
    kind: "listing",
    id: row.id,
    title: row.title,
    priceMillimes: row.price_millimes,
    condition: row.condition,
    reserved: row.status === "reserved",
    imageUrl: image ? listingImageUrl(image.path) : null,
    sellerType: "particulier",
    sellerName: row.seller_name,
    shopLogoPath: null,
    href: `/annonce/${row.id}`,
  };
}

// Vide-Dressing : uniquement des particuliers, uniquement de la mode.
export async function searchVideDressing(filters: MarketFilters) {
  const categories = await getCategories("mode");
  const scope = filters.categorie ? categoryScope(categories, filters.categorie) : null;

  let query = createPublicClient()
    .from("listings")
    .select(LISTING_CARD_COLUMNS, { count: "exact" })
    .eq("section", "vide_dressing")
    .eq("publication_status", "published")
    .neq("status", "sold")
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" });

  if (filters.categorie) query = query.in("category_id", scope?.ids ?? []);
  for (const token of searchTokens(filters.q)) query = query.ilike("search_text", `%${escapeLike(token)}%`);
  if (filters.etat) query = query.eq("condition", filters.etat);
  if (filters.gouvernorat) query = query.eq("governorate_id", Number(filters.gouvernorat) || 0);

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

  return { items: (data as ListingCardRow[]).map(listingCard), total: count ?? 0, categories, scope };
}

export async function getLatestListings(section: ListingSection, limit = 8) {
  const { data, error } = await createPublicClient()
    .from("listings")
    .select(LISTING_CARD_COLUMNS)
    .eq("section", section)
    .eq("publication_status", "published")
    .neq("status", "sold")
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" })
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as ListingCardRow[]).map(listingCard);
}

// Fiche d'annonce : lue avec la session, le vendeur voit aussi son brouillon ou son annonce vendue.
export async function getListing(listingId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, seller_id, seller_name, section, category_id, title, description, brand, size, condition, defects, price_millimes, status, publication_status, published_at, moderated_at, attributes, favorite_count, created_at, categories (slug, name_fr, name_ar, parent_id), governorates (name_fr, name_ar), cities (name_fr, name_ar), listing_images (id, path, position)",
    )
    .eq("id", listingId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...data,
    images: [...data.listing_images].sort((a, b) => a.position - b.position),
  };
}

export async function getViewerListingState(listingId: string, viewerId: string) {
  const supabase = await createClient();
  const [favorite, thread] = await Promise.all([
    supabase.from("listing_favorites").select("listing_id").eq("listing_id", listingId).eq("user_id", viewerId).maybeSingle(),
    supabase.from("listing_threads").select("id").eq("listing_id", listingId).eq("buyer_id", viewerId).maybeSingle(),
  ]);

  return { isFavorite: Boolean(favorite.data), threadId: thread.data?.id ?? null };
}

export async function getMyListings(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, section, title, price_millimes, status, publication_status, moderated_at, favorite_count, created_at, listing_images (path, position)",
    )
    .eq("seller_id", viewerId)
    .order("position", { referencedTable: "listing_images" })
    .limit(1, { referencedTable: "listing_images" })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    ...row,
    imageUrl: row.listing_images[0] ? listingImageUrl(row.listing_images[0].path) : null,
  }));
}

export async function getListingForEdit(listingId: string, viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, section, category_id, title, description, brand, size, condition, defects, price_millimes, governorate_id, city_id, attributes, status, publication_status, moderated_at, listing_images (id, path, position)",
    )
    .eq("id", listingId)
    .eq("seller_id", viewerId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return { ...data, images: [...data.listing_images].sort((a, b) => a.position - b.position) };
}

export async function getListingThreads(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_threads")
    .select("id, listing_id, listing_title, seller_id, buyer_id, seller_name, buyer_name, seller_read_at, buyer_read_at, last_message_at, closed_at")
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return data.map((thread) => {
    const selling = thread.seller_id === viewerId;
    const readAt = selling ? thread.seller_read_at : thread.buyer_read_at;

    return {
      id: thread.id,
      listingId: thread.listing_id,
      listingTitle: thread.listing_title,
      selling,
      otherName: selling ? thread.buyer_name : thread.seller_name,
      lastMessageAt: thread.last_message_at,
      unread: new Date(thread.last_message_at) > new Date(readAt),
      closed: Boolean(thread.closed_at),
    };
  });
}

export async function getListingThread(threadId: string, viewerId: string) {
  const supabase = await createClient();
  const [{ data: thread }, { data: messages }] = await Promise.all([
    supabase
      .from("listing_threads")
      .select("id, listing_id, listing_title, seller_id, buyer_id, seller_name, buyer_name, closed_at")
      .eq("id", threadId)
      .maybeSingle(),
    supabase
      .from("listing_messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", threadId)
      .order("created_at")
      .limit(300),
  ]);

  if (!thread) return null;

  const selling = thread.seller_id === viewerId;

  return {
    ...thread,
    selling,
    otherId: selling ? thread.buyer_id : thread.seller_id,
    otherName: selling ? thread.buyer_name : thread.seller_name,
    messages: (messages ?? []).map((message) => ({ ...message, mine: message.sender_id === viewerId })),
  };
}

export async function getListingFavorites(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listing_favorites")
    .select(`created_at, listings (${LISTING_CARD_COLUMNS})`)
    .eq("user_id", viewerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.flatMap((row) => (row.listings ? [listingCard(row.listings as unknown as ListingCardRow)] : []));
}

export async function getPersonBlocks() {
  const supabase = await createClient();
  const { data } = await supabase.from("person_blocks").select("blocked_id, created_at");
  return data ?? [];
}
