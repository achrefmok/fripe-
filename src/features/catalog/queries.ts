import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { parsePriceToMillimes } from "@/lib/utils/price";
import { CATALOG_PAGE_SIZE } from "./constants";
import type { CategoryOption } from "./csv-import";
import type { CatalogFilters } from "./schemas";

const CARD_COLUMNS =
  "id, title, brand, size, condition, price_millimes, status, shops!inner (name, slug, logo_path, governorate_id), product_images (path, position)";

// Le catalogue mode ne montre que des vêtements, même si une boutique vend aussi en Marketplace.
const MODE_CARD_COLUMNS = `${CARD_COLUMNS}, categories!inner (section)`;

type RawCard = {
  id: string;
  title: string | null;
  brand: string | null;
  size: string | null;
  condition: string | null;
  price_millimes: number | null;
  status: "available" | "reserved" | "sold";
  shops: { name: string; slug: string; logo_path: string | null; governorate_id: number };
  product_images: { path: string; position: number }[];
};

export type ProductCardData = ReturnType<typeof toCard>;

function toCard(row: RawCard) {
  return {
    id: row.id,
    title: row.title ?? "",
    brand: row.brand,
    size: row.size,
    condition: row.condition,
    priceMillimes: row.price_millimes ?? 0,
    status: row.status,
    shopName: row.shops.name,
    shopSlug: row.shops.slug,
    shopLogoPath: row.shops.logo_path,
    imagePath: [...row.product_images].sort((a, b) => a.position - b.position)[0]?.path ?? null,
  };
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

// Même normalisation que le déclencheur SQL prepare_product.
export function searchTokens(query: string) {
  return query
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
}

// Réservé aux membres de la boutique et aux administrateurs : la vue filtre selon la session.
export async function getReferences(productIds: string[]) {
  if (!productIds.length) return new Map<string, string>();

  const supabase = await createClient();
  const { data } = await supabase
    .from("product_references")
    .select("product_id, reference")
    .in("product_id", productIds);

  return new Map(data?.map((row) => [row.product_id!, row.reference!]));
}

async function withReferences<T extends { id: string }>(rows: T[]) {
  const references = await getReferences(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, reference: references.get(row.id) ?? "" }));
}

export async function getReservationTtlMinutes() {
  const { data } = await createPublicClient().rpc("reservation_ttl_minutes");
  return data ?? 120;
}

export type CategorySection = "mode" | "marketplace";

// La mode par défaut : le catalogue, les alertes et les demandes ne voient jamais la Marketplace.
// Les formulaires des boutiques demandent « all », une boutique pouvant vendre dans les deux.
export async function getCategories(
  section: CategorySection | "all" = "mode",
): Promise<(CategoryOption & { parentId: string | null; section: CategorySection })[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("categories")
    .select("id, slug, name_fr, name_ar, parent_id, section")
    .eq("is_active", true)
    .order("position");

  if (section !== "all") query = query.eq("section", section);

  const { data, error } = await query;
  if (error) throw error;

  return data.map((category) => ({
    id: category.id,
    slug: category.slug,
    nameFr: category.name_fr,
    nameAr: category.name_ar,
    parentId: category.parent_id,
    section: category.section,
  }));
}

export async function searchProducts(filters: CatalogFilters) {
  const supabase = createPublicClient();
  const from = (filters.page - 1) * CATALOG_PAGE_SIZE;

  let query = supabase
    .from("products")
    .select(MODE_CARD_COLUMNS, { count: "exact" })
    .eq("categories.section", "mode")
    .eq("publication_status", "published")
    .in("status", ["available", "reserved"])
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" });

  for (const token of searchTokens(filters.q)) {
    query = query.ilike("search_text", `%${escapeLike(token)}%`);
  }

  if (filters.categorie) {
    const categories = await getCategories();
    const parent = categories.find((category) => category.slug === filters.categorie);
    const ids = categories
      .filter((category) => category.id === parent?.id || category.parentId === parent?.id)
      .map((category) => category.id);

    query = query.in("category_id", parent ? ids : []);
  }

  if (filters.taille) query = query.ilike("size", escapeLike(filters.taille));
  if (filters.marque) query = query.ilike("brand", `%${escapeLike(filters.marque)}%`);
  if (filters.etat) query = query.eq("condition", filters.etat);

  if (filters.gouvernorat) {
    query = query.eq("shops.governorate_id", Number(filters.gouvernorat) || 0);
  }

  const minimum = parsePriceToMillimes(filters.prixMin);
  const maximum = parsePriceToMillimes(filters.prixMax);
  if (minimum !== null) query = query.gte("price_millimes", minimum);
  if (maximum !== null) query = query.lte("price_millimes", maximum);

  query =
    filters.tri === "recent"
      ? query.order("published_at", { ascending: false })
      : query.order("price_millimes", { ascending: filters.tri === "price_asc" });

  const { data, count, error } = await query
    .order("id")
    .range(from, from + CATALOG_PAGE_SIZE - 1);

  if (error) throw error;

  return { products: (data as unknown as RawCard[]).map(toCard), total: count ?? 0 };
}

async function feed(
  order: "published_at" | "favorite_count",
  limit: number,
  offset = 0,
  extra?: { popularOnly?: boolean },
) {
  const supabase = createPublicClient();

  let query = supabase
    .from("products")
    .select(MODE_CARD_COLUMNS)
    .eq("categories.section", "mode")
    .eq("publication_status", "published")
    .in("status", ["available", "reserved"])
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .order(order, { ascending: false })
    .order("id")
    .range(offset, offset + limit - 1);

  if (extra?.popularOnly) query = query.gt("favorite_count", 0);

  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as RawCard[]).map(toCard);
}

export async function getHomeFeed() {
  const supabase = createPublicClient();

  const [arrivals, recent, popular, categories, shops, collections] = await Promise.all([
    feed("published_at", 10),
    feed("published_at", 8, 10),
    feed("favorite_count", 8, 0, { popularOnly: true }),
    getCategories(),
    supabase.rpc("top_shops", { p_limit: 6 }),
    supabase
      .from("collections")
      .select("id, name, shops!inner (name, slug), collection_products (count)")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  if (shops.error) throw shops.error;
  if (collections.error) throw collections.error;

  // Chaque boutique se présente par son logo et ses trois dernières pièces.
  const shopIds = shops.data.map((shop) => shop.id);
  const [logos, previews] = shopIds.length
    ? await Promise.all([
        supabase.from("shops").select("id, logo_path").in("id", shopIds),
        supabase
          .from("products")
          .select("shop_id, product_images (path, position)")
          .in("shop_id", shopIds)
          .eq("publication_status", "published")
          .in("status", ["available", "reserved"])
          .order("position", { referencedTable: "product_images" })
          .limit(1, { referencedTable: "product_images" })
          .order("published_at", { ascending: false })
          .limit(shopIds.length * 8),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (logos.error) throw logos.error;
  if (previews.error) throw previews.error;

  return {
    arrivals,
    recent,
    popular,
    categories: categories.filter((category) => !category.parentId),
    // Classement factuel : les boutiques qui proposent le plus de pièces publiées.
    shops: shops.data.map((shop) => ({
      ...shop,
      logoPath: logos.data.find((entry) => entry.id === shop.id)?.logo_path ?? null,
      previews: previews.data
        .filter((product) => product.shop_id === shop.id)
        .flatMap((product) => product.product_images.slice(0, 1).map((image) => image.path))
        .slice(0, 3),
    })),
    collections: collections.data,
  };
}

export async function getProduct(productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, shop_id, category_id, title, description, brand, size, color, condition, defects, price_millimes, status, publication_status, published_at, moderated_at, favorite_count, shops (id, name, slug, status, logo_path, governorates (name_fr, name_ar), cities (name_fr, name_ar)), categories (slug, name_fr, name_ar), product_images (id, path, position)",
    )
    .eq("id", productId)
    .order("position", { referencedTable: "product_images" })
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getSimilarProducts(product: {
  id: string;
  category_id: string | null;
  price_millimes: number | null;
}) {
  if (!product.category_id) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_COLUMNS)
    .eq("publication_status", "published")
    .eq("status", "available")
    .eq("category_id", product.category_id)
    .neq("id", product.id)
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .order("published_at", { ascending: false })
    .limit(4);

  if (error) throw error;

  return (data as unknown as RawCard[]).map(toCard);
}

export async function getViewerProductState(productId: string, viewerId: string) {
  const supabase = await createClient();

  const [favorite, cart, reservation] = await Promise.all([
    supabase
      .from("favorites")
      .select("product_id")
      .eq("product_id", productId)
      .eq("user_id", viewerId)
      .maybeSingle(),
    supabase
      .from("cart_items")
      .select("product_id")
      .eq("product_id", productId)
      .eq("user_id", viewerId)
      .maybeSingle(),
    supabase
      .from("reservations")
      .select("id, expires_at")
      .eq("product_id", productId)
      .eq("client_id", viewerId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  return {
    isFavorite: Boolean(favorite.data),
    inCart: Boolean(cart.data),
    reservation: reservation.data,
  };
}

export async function getFavorites(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select(`created_at, products (${CARD_COLUMNS})`)
    .eq("user_id", viewerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as unknown as { products: RawCard | null }[])
    .flatMap((row) => (row.products ? [toCard(row.products)] : []));
}

export async function getShopCatalog(shopId: string, page: number) {
  const supabase = createPublicClient();
  const from = (page - 1) * CATALOG_PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("products")
    .select(CARD_COLUMNS, { count: "exact" })
    .eq("shop_id", shopId)
    .eq("publication_status", "published")
    .in("status", ["available", "reserved"])
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .order("published_at", { ascending: false })
    .order("id")
    .range(from, from + CATALOG_PAGE_SIZE - 1);

  if (error) throw error;

  return { products: (data as unknown as RawCard[]).map(toCard), total: count ?? 0 };
}

export async function getPublicShop(slug: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("shops")
    .select(
      "id, name, slug, description, phone, logo_path, cover_path, follower_count, rating_count, rating_sum, governorates (name_fr, name_ar), cities (name_fr, name_ar)",
    )
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw error;

  return data;
}

export type PublicShopFilters = { q?: string; governorateId?: number };

// L'annuaire : chaque boutique se présente comme sur l'accueil, par ses trois dernières pièces.
export async function listPublicShops(page: number, filters: PublicShopFilters = {}) {
  const supabase = createPublicClient();
  const from = (page - 1) * CATALOG_PAGE_SIZE;

  let query = supabase
    .from("shops")
    .select(
      "id, name, slug, logo_path, cover_path, description, governorate_id, cities (name_fr, name_ar), governorates (name_fr, name_ar)",
      { count: "exact" },
    )
    .eq("status", "approved");

  const search = filters.q?.replace(/[%_,()\\]/g, " ").trim();
  if (search) query = query.ilike("name", `%${search}%`);
  if (filters.governorateId) query = query.eq("governorate_id", filters.governorateId);

  const { data, count, error } = await query.order("name").range(from, from + CATALOG_PAGE_SIZE - 1);
  if (error) throw error;

  const shopIds = data.map((shop) => shop.id);
  const online = (shopId: string) =>
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("publication_status", "published")
      .in("status", ["available", "reserved"]);

  // Un comptage par boutique : les droits par colonne de products ne permettent pas un comptage imbriqué.
  const [counts, previews] = await Promise.all([
    Promise.all(shopIds.map(online)),
    shopIds.length
      ? supabase
          .from("products")
          .select("shop_id, product_images (path, position)")
          .in("shop_id", shopIds)
          .eq("publication_status", "published")
          .in("status", ["available", "reserved"])
          .order("position", { referencedTable: "product_images" })
          .limit(1, { referencedTable: "product_images" })
          .order("published_at", { ascending: false })
          .limit(shopIds.length * 6)
      : { data: [], error: null },
  ]);
  if (previews.error) throw previews.error;
  const failed = counts.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    shops: data.map((shop, index) => ({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      logoPath: shop.logo_path,
      coverPath: shop.cover_path,
      description: shop.description,
      city: shop.cities,
      governorate: shop.governorates,
      productCount: counts[index].count ?? 0,
      previews: previews.data
        .filter((product) => product.shop_id === shop.id)
        .flatMap((product) => product.product_images.slice(0, 1).map((image) => image.path))
        .slice(0, 3),
    })),
    total: count ?? 0,
  };
}

// Les gouvernorats où au moins une boutique est ouverte : le filtre ne propose rien de vide.
export async function listShopGovernorates() {
  const { data, error } = await createPublicClient()
    .from("shops")
    .select("governorate_id, governorates (name_fr, name_ar)")
    .eq("status", "approved");
  if (error) throw error;

  const seen = new Map<number, { id: number; name_fr: string; name_ar: string; count: number }>();
  for (const shop of data) {
    if (!shop.governorates) continue;
    const entry = seen.get(shop.governorate_id) ?? { id: shop.governorate_id, ...shop.governorates, count: 0 };
    entry.count += 1;
    seen.set(shop.governorate_id, entry);
  }
  return [...seen.values()].sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr"));
}

export async function getPublicCollection(collectionId: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("collections")
    .select(
      `id, name, description, shops!inner (name, slug), collection_products (position, products (${CARD_COLUMNS}))`,
    )
    .eq("id", collectionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const items = data.collection_products as unknown as { products: RawCard | null }[];

  return {
    ...data,
    products: items.flatMap((item) =>
      item.products && item.products.status !== "sold" ? [toCard(item.products)] : [],
    ),
  };
}

// Espace vendeur : client de session, donc limité par RLS aux boutiques du vendeur.
export async function listShopProducts(
  shopId: string,
  publication: "draft" | "published" | "archived",
  search: string,
  page: number,
) {
  const supabase = await createClient();
  const from = (page - 1) * CATALOG_PAGE_SIZE;

  let query = supabase
    .from("products")
    .select(
      "id, title, price_millimes, size, status, publication_status, category_id, condition, moderated_at, product_images (path, position)",
      { count: "exact" },
    )
    .eq("shop_id", shopId)
    .eq("publication_status", publication)
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, from + CATALOG_PAGE_SIZE - 1);

  if (search) {
    const { data: matches } = await supabase
      .from("product_references")
      .select("product_id")
      .eq("shop_id", shopId)
      .ilike("reference", `%${escapeLike(search.trim())}%`)
      .limit(50);

    const text = searchTokens(search)
      .map((token) => `search_text.ilike.%${token.replace(/[,()\\%_]/g, "")}%`)
      .join(",");
    const ids = matches?.length
      ? `id.in.(${matches.map((match) => match.product_id).join(",")})`
      : null;

    query = query.or(ids ? `and(${text}),${ids}` : `and(${text})`);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return { products: await withReferences(data), total: count ?? 0 };
}

// Les marques déjà saisies par la boutique, les plus fréquentes d'abord : proposées en premier.
export async function getShopBrands(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("brand")
    .eq("shop_id", shopId)
    .not("brand", "is", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return [];

  const counts = new Map<string, number>();
  for (const { brand } of data) {
    const value = brand?.trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([brand]) => brand);
}

export async function getProductForEdit(shopId: string, productId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, shop_id, category_id, title, description, brand, size, color, condition, defects, attributes, price_millimes, status, publication_status, published_at, moderated_at, favorite_count, product_images (id, path, position)")
    .eq("id", productId)
    .eq("shop_id", shopId)
    .order("position", { referencedTable: "product_images" })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [product] = await withReferences([data]);
  return product;
}

export async function listOfferableProducts(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price_millimes")
    .eq("shop_id", shopId)
    .eq("publication_status", "published")
    .eq("status", "available")
    .order("published_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return withReferences(data);
}

// Accueil : les dernières pièces de chaque catégorie racine, sous-catégories comprises.
export async function getUniverseShelves(perShelf = 4) {
  const supabase = createPublicClient();
  const categories = await getCategories();
  const roots = categories.filter((category) => !category.parentId);

  return Promise.all(
    roots.map(async (root) => {
      const children = categories.filter((category) => category.parentId === root.id);
      const { data, count, error } = await supabase
        .from("products")
        .select(CARD_COLUMNS, { count: "exact" })
        .eq("publication_status", "published")
        .in("status", ["available", "reserved"])
        .in("category_id", [root.id, ...children.map((child) => child.id)])
        .order("position", { referencedTable: "product_images" })
        .limit(1, { referencedTable: "product_images" })
        .order("published_at", { ascending: false })
        .order("id")
        .limit(perShelf);

      if (error) throw error;

      return {
        ...root,
        children: children.map(({ nameFr, nameAr }) => ({ nameFr, nameAr })),
        products: (data as unknown as RawCard[]).map(toCard),
        total: count ?? 0,
      };
    }),
  );
}

// Accueil : les collections publiées deviennent les looks du défilé.
export async function getRunwayLooks(limit = 6) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("collections")
    .select(`id, name, shops!inner (name, slug, logo_path), collection_products (position, products (${CARD_COLUMNS}))`)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data.flatMap((collection) => {
    const items = (collection.collection_products as unknown as { position: number; products: RawCard | null }[])
      .filter((item) => item.products && item.products.status !== "sold")
      .sort((a, b) => a.position - b.position)
      .map((item) => toCard(item.products!));
    const shop = collection.shops as unknown as { name: string; slug: string; logo_path: string | null };

    return items.length
      ? [{ id: collection.id, name: collection.name, shopName: shop.name, shopSlug: shop.slug, shopLogoPath: shop.logo_path, products: items }]
      : [];
  });
}

// Arrivages -----------------------------------------------------------------------------------

type RawArrival = {
  id: string;
  title: string;
  note: string | null;
  reviewed_at: string | null;
  shops: { name: string; slug: string; logo_path: string | null };
  arrival_products: { position: number; products: RawCard | null }[];
};

const ARRIVAL_COLUMNS = `id, title, note, reviewed_at, shops!inner (name, slug, logo_path, status), arrival_products (position, products (${CARD_COLUMNS}))`;

function toArrival(row: RawArrival) {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    reviewedAt: row.reviewed_at,
    shop: row.shops,
    // Une pièce vendue ou retirée depuis quitte l'arrivage affiché.
    products: [...row.arrival_products]
      .sort((a, b) => a.position - b.position)
      .flatMap((item) => (item.products && item.products.status !== "sold" ? [toCard(item.products)] : [])),
  };
}

export type ArrivalData = ReturnType<typeof toArrival>;

// Les arrivages validés par l'administration, les plus récents d'abord : la tête de l'accueil.
export async function listHomeArrivals(limit = 6) {
  const { data, error } = await createPublicClient()
    .from("arrivals")
    .select(ARRIVAL_COLUMNS)
    .eq("status", "approved")
    .eq("shops.status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as unknown as RawArrival[]).map(toArrival).filter((arrival) => arrival.products.length);
}

export async function getPublicArrival(arrivalId: string) {
  const { data, error } = await createPublicClient()
    .from("arrivals")
    .select(ARRIVAL_COLUMNS)
    .eq("id", arrivalId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw error;
  return data ? toArrival(data as unknown as RawArrival) : null;
}

// Espace vendeur : les arrivages de la boutique, quel que soit leur état.
export async function listShopArrivals(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("arrivals")
    .select("id, title, note, status, review_note, created_at, reviewed_at, arrival_products (product_id)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

// Les pièces en ligne qu'une boutique peut mettre dans un arrivage, avec leur première photo.
export async function listArrivalCandidates(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price_millimes, product_images (path, position)")
    .eq("shop_id", shopId)
    .eq("publication_status", "published")
    .in("status", ["available", "reserved"])
    .order("published_at", { ascending: false })
    .limit(60);

  if (error) throw error;
  return data.map((product) => ({
    id: product.id,
    title: product.title ?? "",
    priceMillimes: product.price_millimes ?? 0,
    imagePath: [...product.product_images].sort((a, b) => a.position - b.position)[0]?.path ?? null,
  }));
}

// Administration : les arrivages en attente, les plus anciens d'abord.
export async function listPendingArrivals() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("arrivals")
    .select(`id, title, note, reviewed_at, created_at, shops!inner (name, slug, logo_path, status), arrival_products (position, products (${CARD_COLUMNS}))`)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw error;
  return (data as unknown as (RawArrival & { created_at: string })[]).map((row) => ({ ...toArrival(row), createdAt: row.created_at }));
}

// Le portant à chiner : les dernières pièces en ligne, à faire défiler cintre par cintre.
export async function listRackProducts(limit = 24) {
  return (await feed("published_at", limit)).filter((product) => product.imagePath && product.status !== "sold");
}
