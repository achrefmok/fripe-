import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { ArrivalCard } from "@/features/arrivals/components/arrival-card";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { getHomeFeed, listHomeArrivals } from "@/features/catalog/queries";
import { DressingHero } from "@/features/home/components/dressing-hero";
import { Garment } from "@/features/home/components/garment";
import { HomeGreeting } from "@/features/home/components/home-greeting";
import { RunwayRing } from "@/features/home/components/runway-ring";
import { universeFor } from "@/features/home/universes";
import { getLatestListings } from "@/features/marketplace/queries";
import { ShopCard } from "@/features/shops/components/shop-card";
import { getWalkPage } from "@/features/walk/queries";
import { getPathname, Link } from "@/i18n/navigation";
import { formatDate, localizedName } from "@/lib/utils/format";
import { productImageUrl, publicVideoUrl } from "@/lib/utils/storage";

export const revalidate = 60;

const EMPTY_FEED = {
  arrivals: [],
  recent: [],
  popular: [],
  categories: [],
  shops: [],
  collections: [],
} satisfies Awaited<ReturnType<typeof getHomeFeed>>;

// Un titre de section en Bodoni et son lien « Tout voir » en or.
function SectionHead({ title, href, link, id }: { title: ReactNode; href?: string; link?: string; id: string }) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between gap-3">
      <h2 id={id} className="font-display text-[clamp(24px,3vw,32px)] leading-tight">{title}</h2>
      {href ? (
        <Link href={href} className="shrink-0 text-[13px] font-medium text-goldink hover:text-harissa">
          {link}
        </Link>
      ) : null}
    </div>
  );
}

// Un cintre dessiné au trait, pour le portant de la carte « chiner ».
function HangerHook() {
  return (
    <svg viewBox="0 0 100 40" className="lx-hook" aria-hidden="true">
      <path d="M50 3c4 0 6 4 3 7-2 1-3 2-3 5" />
      <path d="M50 15 8 36h84z" />
    </svg>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, currentLocale] = await Promise.all([getTranslations("home"), getLocale()]);

  // L'accueil reste affichable si la base est momentanément injoignable.
  const [feed, arrivals, walk, marketLatest, dressingLatest, market] = await Promise.all([
    getHomeFeed().catch((error) => {
      console.error("Accueil : flux indisponible", error);
      return EMPTY_FEED;
    }),
    listHomeArrivals(8).catch((error) => {
      console.error("Accueil : arrivages indisponibles", error);
      return [];
    }),
    getWalkPage(null).catch(() => ({ items: [], nextCursor: null })),
    getLatestListings("marketplace", 1).catch(() => []),
    getLatestListings("vide_dressing", 1).catch(() => []),
    getTranslations("market"),
  ]);

  const rackPhotos = feed.arrivals.filter((product) => product.imagePath).slice(0, 3);
  const cabinPhoto = feed.recent.find((product) => product.imagePath)?.imagePath ?? rackPhotos[0]?.imagePath ?? null;
  const rubriques = [
    { href: "/", label: t("rubriqueMode"), active: true },
    { href: "/marketplace", label: market("marketplaceTitle"), active: false },
    { href: "/vide-dressing", label: market("videDressingTitle"), active: false },
  ];
  const sections = [
    { href: "/marketplace", kicker: t("marketKicker"), title: market("marketplaceTitle"), body: t("marketBody"), image: marketLatest[0]?.imageUrl ?? null, tone: "lx-section--indigo" },
    { href: "/vide-dressing", kicker: t("dressingKicker"), title: market("videDressingTitle"), body: t("dressingBody"), image: dressingLatest[0]?.imageUrl ?? null, tone: "lx-section--bordeaux" },
  ];
  const atelier = [
    { href: "/stylist", name: t("discoverStylist"), scene: ["hauts", "bas", "chaussures"] },
    { href: "/tenues/nouvelle", name: t("discoverOutfit"), scene: ["vestes-manteaux", "robes", "accessoires"] },
    { href: "/walk", name: t("walkTitle"), scene: ["hauts", "vestes-manteaux", "bas"] },
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-[1200px] px-[18px] pt-[18px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <HomeGreeting />
          <nav aria-label={t("rubriquesLabel")} className="lx-segment">
            {rubriques.map((rubrique) => (
              <Link key={rubrique.href} href={rubrique.href} aria-current={rubrique.active ? "page" : undefined} className="lx-segment__item">
                {rubrique.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Une vraie recherche : elle mène au catalogue, filtres compris. */}
        <form action={getPathname({ href: "/catalogue", locale: currentLocale })} role="search" className="lx-search">
          <Search className="size-[18px] shrink-0" aria-hidden="true" />
          <input type="search" name="q" placeholder={t("searchPlaceholder")} aria-label={t("searchLabel")} className="lx-search__input" />
          <button type="submit" className="lx-search__go" aria-label={t("searchSubmit")}>
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </button>
        </form>

        <DressingHero categories={feed.categories} locale={currentLocale} />

        <section className="lx-duo" aria-label={t("toolsLabel")}>
          <Link href="/chine" className="lx-feature">
            <span className="lx-feature__new">{t("newBadge")}</span>
            <span className="lx-feature__title">{t("rackTitle")}</span>
            <span className="lx-feature__body">{t("rackBody")}</span>
            <span className="lx-rack" aria-hidden="true">
              <span className="lx-rack__rod" />
              <span className="lx-rack__hangers">
                {rackPhotos.map((product, index) => (
                  <span key={product.id} className="lx-rack__piece" data-slot={index}>
                    <HangerHook />
                    <span className="lx-rack__photo">
                      <Image src={productImageUrl(product.imagePath!)} alt="" fill unoptimized sizes="4rem" className="object-cover" />
                    </span>
                  </span>
                ))}
              </span>
            </span>
            <span className="lx-feature__go">{t("rackGo")}</span>
          </Link>
          <Link href="/tenues/nouvelle" className="lx-feature lx-feature--row">
            <span className="flex flex-1 flex-col gap-2">
              <span className="luxe-kicker">{t("discoverOutfit")}</span>
              <span className="lx-feature__title">{t("cabinTitle")}</span>
              <span className="lx-feature__body">{t("cabinBody")}</span>
              <span className="lx-feature__go mt-auto">{t("cabinGo")}</span>
            </span>
            <span className="lx-cabin" aria-hidden="true">
              {cabinPhoto ? <Image src={productImageUrl(cabinPhoto)} alt="" fill unoptimized sizes="8rem" className="object-cover" /> : null}
              <span className="lx-cabin__curtain lx-cabin__curtain--left" />
              <span className="lx-cabin__curtain lx-cabin__curtain--right" />
            </span>
          </Link>
        </section>

        {walk.items.length ? (
          <section className="mt-[26px]" aria-labelledby="walk-titre">
            <SectionHead id="walk-titre" title={t("walkTitle")} href="/walk" link={t("seeAll")} />
            <ul className="lx-stories rail-scroll">
              {walk.items.map((item) => (
                <li key={item.id}>
                  <Link href={{ pathname: "/walk", query: { v: item.id } }} className="lx-story">
                    <span className="lx-story__ring">
                      <span className="lx-story__frame">
                        <Image src={publicVideoUrl(item.thumbnailPath)} alt="" fill unoptimized sizes="4.5rem" className="object-cover" />
                      </span>
                    </span>
                    <span className="lx-story__label" dir="auto">{item.shop.name.split(" ")[0]}{item.description ? ` · ${item.description.split(" ")[0]}` : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {arrivals.length ? (
          <section className="mt-7" aria-labelledby="arrivages-titre">
            <SectionHead id="arrivages-titre" title={t("arrivalsTitle")} href="/boutiques" link={t("seeAll")} />
            <ul className="lx-arrivals rail-scroll">
              {arrivals.map((arrival) => (
                <li key={arrival.id}>
                  <ArrivalCard
                    arrival={arrival}
                    piecesLabel={t("shopPieces", { count: arrival.products.length })}
                    dateLabel={arrival.reviewedAt ? formatDate(arrival.reviewedAt, currentLocale) : null}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <RunwayRing products={feed.arrivals.filter((product) => product.imagePath).slice(0, 8)} />

      <div className="mx-auto w-full max-w-[1200px] px-[18px]">
        {feed.recent.length ? (
          <section className="mt-10" aria-labelledby="selection-titre">
            <SectionHead id="selection-titre" title={t("selectionTitle")} href="/catalogue" link={t("seeAll")} />
            <ProductGrid products={feed.recent} />
          </section>
        ) : (
          <section className="mt-10">
            <h2 className="font-display text-3xl">{t("emptyTitle")}</h2>
            <p className="mt-2 max-w-md text-muted-foreground">{t("emptyBody")}</p>
          </section>
        )}

        {feed.shops.length ? (
          <section className="mt-10" aria-labelledby="boutiques-titre">
            <SectionHead id="boutiques-titre" title={t("shopsTitle")} href="/boutiques" link={t("seeAll")} />
            <ul className="lx-shops rail-scroll">
              {feed.shops.map((shop) => (
                <li key={shop.id}>
                  <ShopCard
                    name={shop.name}
                    slug={shop.slug}
                    logoPath={shop.logoPath}
                    previews={shop.previews}
                    meta={`${localizedName({ name_fr: shop.city_fr, name_ar: shop.city_ar }, currentLocale)} · ${t("shopPieces", { count: shop.product_count })}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="lx-sections" aria-label={t("sectionsTitle")}>
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className={`lx-section ${section.tone} group`}>
              {section.image ? (
                <Image src={section.image} alt="" fill unoptimized sizes="(min-width: 768px) 50vw, 100vw" className="lx-section__photo" />
              ) : null}
              <span className="lx-section__veil" aria-hidden="true" />
              <span className="lx-section__kicker">{section.kicker}</span>
              <span className="lx-section__title">{section.title}</span>
              <span className="lx-section__body">{section.body}</span>
            </Link>
          ))}
        </section>

        <section className="lx-atelier" aria-label={t("atelierLabel")}>
          <ul>
            {atelier.map((row) => (
              <li key={row.href}>
                <Link href={row.href} className="lx-atelier__row">
                  <span className="lx-atelier__name"><em>{row.name}</em></span>
                  <span className="lx-atelier__scene" aria-hidden="true">
                    {row.scene.map((slug) => (
                      <Garment key={slug} universe={universeFor(slug)} className="lx-atelier__piece" />
                    ))}
                  </span>
                  <span className="lx-atelier__go" aria-hidden="true">
                    <ArrowRight className="size-4 rtl:-scale-x-100" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
