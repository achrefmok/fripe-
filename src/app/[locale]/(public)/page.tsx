import { ArrowRight, Play } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { ProductGrid, ProductRail } from "@/features/catalog/components/product-card";
import { getHomeFeed, getRunwayLooks, getUniverseShelves } from "@/features/catalog/queries";
import { getLatestListings } from "@/features/marketplace/queries";
import { VideoRail } from "@/features/walk/components/video-rail";
import { getWalkPage } from "@/features/walk/queries";
import { DressingHero } from "@/features/home/components/dressing-hero";
import { Runway, type Look } from "@/features/home/components/runway";
import { UniverseProvider } from "@/features/home/components/universe-context";
import { UniverseShowcase, type Shelf } from "@/features/home/components/universe-showcase";
import { Garment } from "@/features/home/components/garment";
import { universeFor } from "@/features/home/universes";
import { ShopTile } from "@/features/shops/components/shop-tile";
import { Link } from "@/i18n/navigation";
import { productImageUrl } from "@/lib/utils/storage";
import Image from "next/image";
import { localizedName } from "@/lib/utils/format";

export const revalidate = 60;

// Les sections d'un même chapitre partagent un filet : on voit ce qui va ensemble.
function Section({
  title,
  href,
  linkLabel,
  divided = false,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  divided?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 md:px-6">
      <div className={divided ? "border-t-2 border-foreground/80 pt-8 pb-10 md:pt-10 md:pb-14" : "pt-10 pb-10 md:pt-14 md:pb-14"}>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl leading-tight font-extrabold md:text-4xl">{title}</h2>
        {href ? (
          <Link href={href} className="shrink-0 text-sm font-semibold underline underline-offset-4">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
      </div>
    </section>
  );
}

// Le rayon le mieux fourni ouvre la vitrine : le visiteur voit d'abord des pièces.
function busiestShelf(shelves: Shelf[]) {
  return shelves.reduce<Shelf | null>((best, shelf) => (!best || shelf.total > best.total ? shelf : best), null)?.slug ?? null;
}

const EMPTY_FEED = {
  arrivals: [],
  recent: [],
  popular: [],
  categories: [],
  shops: [],
  collections: [],
} satisfies Awaited<ReturnType<typeof getHomeFeed>>;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const currentLocale = await getLocale();

  // L'accueil reste affichable si la base est momentanément injoignable.
  const [feed, shelfRows, lookRows, marketLatest, dressingLatest, market, walk, walkT] = await Promise.all([
    getHomeFeed().catch((error) => {
      console.error("Accueil : flux indisponible", error);
      return EMPTY_FEED;
    }),
    getUniverseShelves().catch((error) => {
      console.error("Accueil : univers indisponibles", error);
      return [];
    }),
    getRunwayLooks().catch((error) => {
      console.error("Accueil : looks indisponibles", error);
      return [];
    }),
    getLatestListings("marketplace", 3).catch(() => []),
    getLatestListings("vide_dressing", 3).catch(() => []),
    getTranslations("market"),
    getWalkPage(null).catch(() => ({ items: [], nextCursor: null })),
    getTranslations("walk"),
  ]);

  // Les deux autres rubriques, présentées par leurs vraies dernières annonces.
  const sections = [
    { href: "/marketplace", title: market("marketplaceTitle"), body: market("marketplaceBody"), items: marketLatest, tone: "sell-tile--marketplace" },
    { href: "/vide-dressing", title: market("videDressingTitle"), body: market("videDressingBody"), items: dressingLatest, tone: "sell-tile--dressing" },
  ];

  const ar = currentLocale === "ar";
  const shelves: Shelf[] = shelfRows.map((row) => ({
    slug: row.slug,
    name: ar ? row.nameAr : row.nameFr,
    description: row.children.map((child) => (ar ? child.nameAr : child.nameFr)).join(ar ? "، " : ", "),
    products: row.products,
    total: row.total,
  }));

  // Les collections des boutiques font les looks ; sans collection, chaque arrivage défile seul.
  const looks: Look[] = lookRows.length
    ? lookRows.map((row) => ({
        id: row.id,
        title: row.name,
        shopName: row.shopName,
        shopLogoPath: row.shopLogoPath,
        href: `/boutique/${row.shopSlug}/collection/${row.id}`,
        products: row.products,
      }))
    : feed.arrivals.slice(0, 6).map((product) => ({
        id: product.id,
        title: product.title,
        shopName: product.shopName,
        shopLogoPath: product.shopLogoPath,
        href: `/produit/${product.id}`,
        products: [product],
      }));

  // Les rails de pièces : les arrivages ne sont listés que si le défilé montre des collections.
  const pieceSections = [
    lookRows.length && feed.arrivals.length
      ? { key: "arrivals", title: t("arrivalsTitle"), href: "/catalogue", node: <ProductRail products={feed.arrivals} /> }
      : null,
    feed.popular.length ? { key: "popular", title: t("popularTitle"), href: undefined, node: <ProductRail products={feed.popular} /> } : null,
    feed.recent.length ? { key: "recent", title: t("recentTitle"), href: "/catalogue", node: <ProductGrid products={feed.recent} /> } : null,
  ].filter((section) => section !== null);

  return (
    <>
      <UniverseProvider initial={busiestShelf(shelves)}>
        <DressingHero categories={feed.categories} locale={currentLocale} hasRunway={looks.length > 0} />
        <div className="rail text-ink dark:text-paper" aria-hidden="true" />
        <UniverseShowcase shelves={shelves} />
      </UniverseProvider>

      {walk.items.length ? (
        <Section title={t("videosTitle")} href="/walk" linkLabel={t("videosAll")}>
          <VideoRail items={walk.items} locale={currentLocale} playLabel={walkT("play")} />
        </Section>
      ) : null}

      {looks.length ? (
        <Runway
          looks={looks}
          title={t(lookRows.length ? "runwayLooksTitle" : "runwayArrivalsTitle")}
          cta={t(lookRows.length ? "runwaySeeLook" : "runwaySeePiece")}
        />
      ) : null}

      {pieceSections.length ? (
        pieceSections.map((section, index) => (
          <Section key={section.key} title={section.title} href={section.href} linkLabel={t("seeAll")} divided={index > 0}>
            {section.node}
          </Section>
        ))
      ) : (
        <Section title={t("emptyTitle")}>
          <p className="max-w-md text-muted-foreground">{t("emptyBody")}</p>
        </Section>
      )}

      <Section title={t("sectionsTitle")} divided>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          {sections.map((section) => (
            <li key={section.href}>
              <Link href={section.href} className={`sell-tile ${section.tone} gap-4`}>
                <span className="font-display text-3xl font-extrabold">{section.title}</span>
                <span className="max-w-md leading-snug">{section.body}</span>
                {section.items.length ? (
                  <span className="mt-auto grid grid-cols-3 gap-1.5" aria-hidden="true">
                    {section.items.map((item) => (
                      <span key={item.id} className="relative aspect-[3/4] overflow-hidden rounded-[2px] bg-black/15">
                        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill unoptimized sizes="(min-width: 768px) 12rem, 30vw" className="object-cover" /> : null}
                      </span>
                    ))}
                  </span>
                ) : null}
                <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {feed.shops.length ? (
        <Section title={t("shopsTitle")} href="/boutiques" linkLabel={t("seeAll")} divided>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-3">
            {feed.shops.map((shop) => (
              <li key={shop.id}>
                <ShopTile
                  name={shop.name}
                  slug={shop.slug}
                  logoPath={shop.logoPath}
                  previews={shop.previews}
                  place={localizedName({ name_fr: shop.city_fr, name_ar: shop.city_ar }, currentLocale)}
                  pieces={t("shopPieces", { count: shop.product_count })}
                />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* Sans look montrable, les collections restent listées : une collection vide reste une collection. */}
      {!lookRows.length && feed.collections.length ? (
        <Section title={t("collectionsTitle")} divided>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-3">
            {feed.collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/boutique/${collection.shops.slug}/collection/${collection.id}`}
                  className="block bg-secondary px-4 py-4 transition-colors hover:bg-foreground hover:text-background"
                >
                  <span className="block truncate font-display text-lg font-bold">{collection.name}</span>
                  <span className="block truncate text-sm opacity-75">{collection.shops.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}


      {/* L'atelier : les outils pour chiner autrement, présentés comme des étiquettes de collection. */}
      <section className="atelier" aria-labelledby="atelier-titre">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="atelier__head">
            <h2 id="atelier-titre" className="atelier__title">{t("atelierTitle")}</h2>
            <p className="atelier__lead">{t("atelierLead")}</p>
          </div>
          <ul className="atelier__list">
            <li>
              <Link href="/stylist" className="atelier__row">
                <span className="atelier__text">
                  <span className="atelier__name">{t("discoverStylist")}</span>
                  <span className="atelier__body">{t("discoverStylistBody")}</span>
                </span>
                {/* Une tenue complète sous une étiquette de budget. */}
                <span className="atelier__visual atelier-stylist" aria-hidden="true">
                  <span className="atelier-stylist__tag">{t("discoverStylistTag")}</span>
                  <Garment universe={universeFor("hauts")} className="atelier-stylist__piece" />
                  <Garment universe={universeFor("bas")} className="atelier-stylist__piece" />
                  <Garment universe={universeFor("chaussures")} className="atelier-stylist__piece" />
                </span>
                <span className="atelier__go">
                  {t("discoverTry")}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                </span>
              </Link>
            </li>
            <li>
              <Link href="/tenues/nouvelle" className="atelier__row">
                <span className="atelier__text">
                  <span className="atelier__name">{t("discoverOutfit")}</span>
                  <span className="atelier__body">{t("discoverOutfitBody")}</span>
                </span>
                {/* Trois pièces qui s'assemblent. */}
                <span className="atelier__visual atelier-outfit" aria-hidden="true">
                  <Garment universe={universeFor("vestes-manteaux")} className="atelier-outfit__piece" />
                  <Garment universe={universeFor("robes")} className="atelier-outfit__piece" />
                  <Garment universe={universeFor("accessoires")} className="atelier-outfit__piece" />
                </span>
                <span className="atelier__go">
                  {t("discoverTry")}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                </span>
              </Link>
            </li>
            <li>
              <Link href="/walk" className="atelier__row">
                <span className="atelier__text">
                  <span className="atelier__name">{t("discoverWalk")}</span>
                  <span className="atelier__body">{t("discoverWalkBody")}</span>
                </span>
                {/* Trois écrans verticaux, avec les vraies dernières pièces. */}
                <span className="atelier__visual atelier-walk" aria-hidden="true">
                  {[0, 1, 2].map((slot) => (
                    <span key={slot} className="atelier-walk__frame">
                      {feed.arrivals[slot]?.imagePath ? (
                        <Image src={productImageUrl(feed.arrivals[slot].imagePath!)} alt="" fill unoptimized sizes="5rem" className="object-cover" />
                      ) : null}
                      {slot === 1 ? (
                        <span className="atelier-walk__play">
                          <Play className="size-3.5 fill-current" />
                        </span>
                      ) : null}
                    </span>
                  ))}
                </span>
                <span className="atelier__go">
                  {t("discoverWatch")}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                </span>
              </Link>
            </li>
          </ul>
        </div>
      </section>

    </>
  );
}
