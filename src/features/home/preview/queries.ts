import "server-only";
import { getCategories, getHomeFeed, listHomeArrivals, type ProductCardData } from "@/features/catalog/queries";
import { getDailyPicks, getDressingOverview, type DressingItem } from "@/features/dressing/queries";
import { getLatestListings, type MarketItem } from "@/features/marketplace/queries";
import { getWalkPage } from "@/features/walk/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { localizedName } from "@/lib/utils/format";
import { listingImageUrl, productImageUrl, publicVideoUrl } from "@/lib/utils/storage";
import type { Database } from "@/types/database";
import { UNIVERSES, type UniverseIcon, type UniverseKey } from "./universes";

type Condition = Database["public"]["Enums"]["product_condition"];

// Une pièce, qu'elle vienne d'une boutique ou d'un particulier : ce que la carte unique affiche.
export type Piece = {
  kind: "product" | "listing";
  id: string;
  href: string;
  title: string;
  priceMillimes: number;
  condition: Condition | null;
  size: string | null;
  imageUrl: string | null;
  reserved: boolean;
  sellerName: string;
  sellerLogoPath: string | null;
  pro: boolean;
};

export function fromProduct(product: ProductCardData): Piece {
  return {
    kind: "product",
    id: product.id,
    href: `/produit/${product.id}`,
    title: product.title,
    priceMillimes: product.priceMillimes,
    condition: product.condition as Condition | null,
    size: product.size,
    imageUrl: product.imagePath ? productImageUrl(product.imagePath) : null,
    reserved: product.status === "reserved",
    sellerName: product.shopName,
    sellerLogoPath: product.shopLogoPath,
    pro: true,
  };
}

function fromDressing(item: DressingItem): Piece {
  return {
    kind: "listing",
    id: item.id,
    href: `/annonce/${item.id}`,
    title: item.title,
    priceMillimes: item.priceMillimes,
    condition: item.condition,
    size: item.size,
    imageUrl: item.imageUrl,
    reserved: item.reserved,
    sellerName: item.sellerName,
    sellerLogoPath: null,
    pro: false,
  };
}

function fromMarket(item: MarketItem): Piece {
  return {
    kind: item.kind,
    id: item.id,
    href: item.href,
    title: item.title,
    priceMillimes: item.priceMillimes,
    condition: item.condition,
    size: null,
    imageUrl: item.imageUrl,
    reserved: item.reserved,
    sellerName: item.sellerName,
    sellerLogoPath: item.shopLogoPath,
    pro: item.sellerType === "pro",
  };
}

// Une pièce n'apparaît qu'une fois par liste, même si deux sources la renvoient.
function unique(pieces: Piece[]) {
  const seen = new Set<string>();
  return pieces.filter((piece) => {
    const key = `${piece.kind}:${piece.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type PreviewUniverse = {
  key: UniverseKey;
  icon: UniverseIcon;
  href: string;
  imageUrl: string | null;
  links: { href: string; label: string }[];
};

export type PreviewCollection = { key: "new" | "loved" | "daily" | "deals" | "brands" | "objects"; pieces: Piece[] };

const EMPTY_FEED = { arrivals: [], recent: [], popular: [], categories: [], shops: [], collections: [] } satisfies Awaited<
  ReturnType<typeof getHomeFeed>
>;
const EMPTY_OVERVIEW = { dressings: [], brands: [], sizes: [], latest: [], deals: [], branded: [] } satisfies Awaited<
  ReturnType<typeof getDressingOverview>
>;

// Une vraie photo par univers : la dernière pièce publiée, avec photo, dans l'une de ses catégories.
async function universeCovers(rootOf: Map<string, string>) {
  const supabase = createPublicClient();
  const [products, listings] = await Promise.all([
    supabase
      .from("products")
      .select("category_id, product_images (path, position)")
      .eq("publication_status", "published")
      .in("status", ["available", "reserved"])
      .order("position", { referencedTable: "product_images" })
      .limit(1, { referencedTable: "product_images" })
      .order("published_at", { ascending: false })
      .limit(120),
    supabase
      .from("listings")
      .select("category_id, listing_images (path, position)")
      .eq("publication_status", "published")
      .neq("status", "sold")
      .order("position", { referencedTable: "listing_images" })
      .limit(1, { referencedTable: "listing_images" })
      .order("published_at", { ascending: false })
      .limit(160),
  ]);
  if (products.error) throw products.error;
  if (listings.error) throw listings.error;

  const covers = new Map<string, string>();
  const keep = (categoryId: string | null, url: string | null) => {
    const root = categoryId ? rootOf.get(categoryId) : undefined;
    if (root && url && !covers.has(root)) covers.set(root, url);
  };
  for (const row of products.data) keep(row.category_id, row.product_images[0] ? productImageUrl(row.product_images[0].path) : null);
  for (const row of listings.data) keep(row.category_id, row.listing_images[0] ? listingImageUrl(row.listing_images[0].path) : null);
  return covers;
}

// Tout ce que l'accueil d'essai montre vient de la base. Chaque source a son repli : si l'une ne
// répond pas, sa section disparaît et le reste de la page s'affiche.
export async function getPreviewData(locale: string) {
  const [feed, overview, picks, objects, walk, categories, arrivals] = await Promise.all([
    getHomeFeed().catch((error) => {
      console.error("Accueil d'essai : flux indisponible", error);
      return EMPTY_FEED;
    }),
    getDressingOverview().catch(() => EMPTY_OVERVIEW),
    getDailyPicks(8).catch(() => []),
    getLatestListings("marketplace", 8).catch(() => []),
    getWalkPage(null).catch(() => ({ items: [], nextCursor: null })),
    getCategories("all").catch(() => []),
    // Les arrivages validés par l'administration, repris de l'ancien accueil.
    listHomeArrivals(8).catch((error) => {
      console.error("Accueil : arrivages indisponibles", error);
      return [];
    }),
  ]);

  const roots = new Map(categories.filter((category) => !category.parentId).map((category) => [category.slug, category]));
  const rootOf = new Map<string, string>();
  for (const category of categories) {
    const parent = category.parentId ? categories.find((entry) => entry.id === category.parentId) : category;
    if (parent) rootOf.set(category.id, parent.slug);
  }
  const covers = await universeCovers(rootOf).catch(() => new Map<string, string>());
  const name = (category: { nameFr: string; nameAr: string }) => localizedName({ name_fr: category.nameFr, name_ar: category.nameAr }, locale);

  const universes: PreviewUniverse[] = UNIVERSES.flatMap((universe) => {
    const present = universe.roots.map((slug) => roots.get(slug)).filter((root) => root !== undefined);
    if (!present.length) return [];
    // Une seule racine : ses sous-catégories. Plusieurs : les racines elles-mêmes.
    const links =
      present.length === 1
        ? categories.filter((category) => category.parentId === present[0].id).slice(0, 4)
        : present.slice(0, 4);
    return [
      {
        key: universe.key,
        icon: universe.icon,
        href: `${universe.catalog}${present.length === 1 || universe.catalog === "/marketplace" ? `?categorie=${present[0].slug}` : ""}`,
        imageUrl: universe.roots.map((slug) => covers.get(slug)).find(Boolean) ?? null,
        links: links.map((category) => ({ href: `${universe.catalog}?categorie=${category.slug}`, label: name(category) })),
      },
    ];
  });

  const collections: PreviewCollection[] = (
    [
      { key: "new", pieces: feed.arrivals.map(fromProduct) },
      { key: "loved", pieces: feed.popular.map(fromProduct) },
      { key: "daily", pieces: picks.map(fromDressing) },
      { key: "deals", pieces: overview.deals.map(fromDressing) },
      { key: "brands", pieces: overview.branded.map(fromDressing) },
      { key: "objects", pieces: objects.map(fromMarket) },
    ] satisfies PreviewCollection[]
  )
    .map((collection) => ({ ...collection, pieces: unique(collection.pieces) }))
    .filter((collection) => collection.pieces.length);

  // Les dernières pièces, boutiques et particuliers mêlés une à une.
  const shopPieces = feed.recent.map(fromProduct);
  const personPieces = [...overview.latest.map(fromDressing), ...objects.map(fromMarket)];
  const mixed: Piece[] = [];
  for (let index = 0; index < Math.max(shopPieces.length, personPieces.length); index += 1) {
    if (shopPieces[index]) mixed.push(shopPieces[index]);
    if (personPieces[index]) mixed.push(personPieces[index]);
  }
  const latest = unique(mixed).slice(0, 12);

  const heroPieces = unique([...feed.arrivals.map(fromProduct), ...picks.map(fromDressing)].filter((piece) => piece.imageUrl)).slice(0, 4);

  return {
    heroPieces,
    universes,
    collections,
    walk: walk.items.slice(0, 8).map((item) => ({
      id: item.id,
      thumbnailUrl: publicVideoUrl(item.thumbnailPath),
      shopName: item.shop.name,
      description: item.description,
      fromMillimes: item.products.length ? Math.min(...item.products.map((product) => product.priceMillimes)) : null,
    })),
    wardrobes: overview.dressings.slice(0, 6).map((dressing) => ({
      sellerId: dressing.sellerId,
      sellerName: dressing.sellerName,
      place: dressing.place ? localizedName(dressing.place, locale) : null,
      count: dressing.count,
      brands: dressing.brands,
      previews: [...new Set(dressing.previews)],
    })),
    latest,
    arrivals,
    // Les boutiques les plus fournies, chacune avec son logo et ses trois dernières pièces.
    shops: feed.shops.map((shop) => ({
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      logoPath: shop.logoPath,
      previews: shop.previews,
      city: localizedName({ name_fr: shop.city_fr, name_ar: shop.city_ar }, locale),
      count: shop.product_count,
    })),
  };
}

export type PreviewData = Awaited<ReturnType<typeof getPreviewData>>;
