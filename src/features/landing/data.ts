import "server-only";
import { getTranslations } from "next-intl/server";
import { getHomeFeed, listHomeArrivals, type ProductCardData } from "@/features/catalog/queries";
import { getWalkPage } from "@/features/walk/queries";
import { localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl, publicVideoUrl, shopAssetUrl } from "@/lib/utils/storage";

// Les silhouettes dessinées quand une pièce n'a pas encore de photo.
export type GarmentShape = "tee" | "dress" | "jacket" | "sweat" | "skirt" | "bag" | "cap" | "shoe" | "belt";

export type LandingPiece = {
  id: string;
  title: string;
  meta: string;
  price: string;
  imageUrl: string | null;
  garment: GarmentShape;
  tone: { cloth: string; ground: string };
};

export type LandingData = {
  year: number;
  pieces: LandingPiece[];
  hero: LandingPiece | null;
  favorites: LandingPiece[];
  searchPieces: LandingPiece[];
  categories: { slug: string; name: string }[];
  shop: { name: string; slug: string; city: string; count: number; previews: string[] } | null;
  shops: { name: string; slug: string; initial: string; logoUrl: string | null }[];
  cities: string[];
  notifications: { kind: "arrival" | "walk"; text: string; when: string; href: string }[];
  walkThumb: string | null;
  rackPhotos: string[];
  cabinPhotos: string[];
};

const GARMENTS: GarmentShape[] = ["jacket", "dress", "tee", "sweat", "skirt", "bag", "shoe", "cap", "belt"];
const TONES = [
  { cloth: "#3d5a80", ground: "#dde4ec" },
  { cloth: "#b25634", ground: "#f4e0d6" },
  { cloth: "#cca45e", ground: "#f3ead6" },
  { cloth: "#6b7b5e", ground: "#e4e8de" },
  { cloth: "#c4566e", ground: "#f6e1e5" },
  { cloth: "#2b211b", ground: "#e6ddd2" },
  { cloth: "#b8925a", ground: "#f2e8d6" },
];

function toPiece(product: ProductCardData, index: number, locale: string): LandingPiece {
  return {
    id: product.id,
    title: product.title,
    meta: [product.size, product.shopName].filter(Boolean).join(" · "),
    price: formatPrice(product.priceMillimes, locale),
    imageUrl: product.imagePath ? productImageUrl(product.imagePath) : null,
    garment: GARMENTS[index % GARMENTS.length],
    tone: TONES[index % TONES.length],
  };
}

function relative(date: string, now: number, locale: string) {
  const format = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-TN" : "fr-FR", { numeric: "auto" });
  const minutes = Math.round((new Date(date).getTime() - now) / 60_000);
  if (Math.abs(minutes) < 60) return format.format(Math.min(minutes, -1), "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  return format.format(Math.round(hours / 24), "day");
}

const EMPTY_FEED = { arrivals: [], recent: [], popular: [], categories: [], shops: [], collections: [] } satisfies Awaited<
  ReturnType<typeof getHomeFeed>
>;

// Tout ce que la page de découverte montre vient de la base : pièces, boutiques, arrivages, défilés.
// Si la base ne répond pas, la page reste lisible avec ses silhouettes dessinées.
export async function getLandingData(locale: string): Promise<LandingData> {
  // L’heure du rendu sert aux « il y a 2 h » des notifications ; la page est régénérée chaque minute.
  const now = Date.now();
  const [feed, arrivals, walk, t] = await Promise.all([
    getHomeFeed().catch((error) => {
      console.error("Découvrir : flux indisponible", error);
      return EMPTY_FEED;
    }),
    listHomeArrivals(3).catch(() => []),
    getWalkPage(null).catch(() => ({ items: [], nextCursor: null })),
    getTranslations({ locale, namespace: "landing" }),
  ]);

  // Une pièce n'apparaît qu'une fois, même si elle est à la fois récente et populaire.
  const seen = new Set<string>();
  const all = [...feed.arrivals, ...feed.recent, ...feed.popular].filter((product) => !seen.has(product.id) && seen.add(product.id));
  const pieces = all.map((product, index) => toPiece(product, index, locale));
  const withPhoto = pieces.filter((piece) => piece.imageUrl);
  const byId = new Map(pieces.map((piece) => [piece.id, piece]));
  const popular = feed.popular.map((product) => byId.get(product.id)!).filter(Boolean);

  const top = feed.shops[0];
  const walkItems = walk.items.slice(0, 2);
  const notifications = [
    ...arrivals.map((arrival) => ({
      kind: "arrival" as const,
      text: t("notifArrival", { shop: arrival.shop.name, count: arrival.products.length }),
      when: arrival.reviewedAt ?? "",
      href: `/boutique/${arrival.shop.slug}/arrivage/${arrival.id}`,
    })),
    ...walkItems.map((item) => ({
      kind: "walk" as const,
      text: t("notifWalk", { shop: item.shop.name }),
      when: item.publishedAt,
      href: `/walk?v=${item.id}`,
    })),
  ]
    .filter((entry) => entry.when)
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 5)
    .map((entry) => ({ ...entry, when: relative(entry.when, now, locale) }));

  const cities = [...new Set(feed.shops.map((shop) => localizedName({ name_fr: shop.city_fr, name_ar: shop.city_ar }, locale)))].slice(0, 3);

  return {
    year: new Date(now).getFullYear(),
    pieces: pieces.slice(0, 14),
    hero: popular.find((piece) => piece.imageUrl) ?? withPhoto[0] ?? pieces[0] ?? null,
    favorites: (popular.length ? popular : pieces).slice(0, 5),
    searchPieces: (withPhoto.length >= 4 ? withPhoto : pieces).slice(0, 6),
    categories: feed.categories.map((category) => ({ slug: category.slug, name: localizedName({ name_fr: category.nameFr, name_ar: category.nameAr }, locale) })),
    shop: top
      ? {
          name: top.name,
          slug: top.slug,
          city: localizedName({ name_fr: top.city_fr, name_ar: top.city_ar }, locale),
          count: top.product_count,
          previews: top.previews.map(productImageUrl),
        }
      : null,
    shops: feed.shops.slice(0, 4).map((shop) => ({
      name: shop.name,
      slug: shop.slug,
      initial: shop.name.trim().charAt(0).toUpperCase(),
      logoUrl: shop.logoPath ? shopAssetUrl(shop.logoPath) : null,
    })),
    cities,
    notifications,
    walkThumb: walkItems[0] ? publicVideoUrl(walkItems[0].thumbnailPath) : null,
    rackPhotos: withPhoto.slice(0, 4).map((piece) => piece.imageUrl!),
    cabinPhotos: withPhoto.slice(4, 6).map((piece) => piece.imageUrl!),
  };
}
