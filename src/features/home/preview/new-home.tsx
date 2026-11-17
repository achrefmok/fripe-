import { ArrowRight, Baby, BookOpen, DoorOpen, Dumbbell, Footprints, Laptop, Layers, Play, Radio, Search, Shirt, Sofa, Sparkles, Store, UserRound, Watch } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ArrivalCard } from "@/features/arrivals/components/arrival-card";
import { DressingFavorites } from "@/features/dressing/components/favorites";
import { CollectionTabs } from "@/features/home/preview/collection-tabs";
import { PieceCard } from "@/features/home/preview/piece-card";
import { getPreviewData } from "@/features/home/preview/queries";
import type { UniverseIcon } from "@/features/home/preview/universes";
import "@/features/home/preview/preview.css";
import { getPathname, Link } from "@/i18n/navigation";
import { ShopCard } from "@/features/shops/components/shop-card";
import { formatDate } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";


const ICONS: Record<UniverseIcon, typeof Shirt> = {
  shirt: Shirt,
  footprints: Footprints,
  sofa: Sofa,
  laptop: Laptop,
  dumbbell: Dumbbell,
  book: BookOpen,
  baby: Baby,
  watch: Watch,
};

function SectionHead({ id, kicker, title, body, link }: { id: string; kicker: string; title: ReactNode; body?: string; link?: { href: string; label: string } }) {
  return (
    <div className="hp-head">
      <div>
        <p className="luxe-kicker">{kicker}</p>
        <h2 id={id} className="hp-head__title">{title}</h2>
        {body ? <p className="hp-head__body">{body}</p> : null}
      </div>
      {link ? (
        <Link href={link.href} className="hp-head__link">
          {link.label} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

// Le nouvel accueil, en prévisualisation sur /accueil-preview : de vraies pièces, des univers, des collections, Fripe Walk, les arrivages et les
// boutiques, les armoires du Vide-Dressing, l'atelier, puis vendre. Chaque section disparaît si elle est vide.
// `route` : la page où l'on revient après s'être connecté depuis un cœur.
export async function NewHome({ locale, route }: { locale: string; route: string }) {
  const [t, home, data] = await Promise.all([getTranslations("homePreview"), getTranslations("home"), getPreviewData(locale)]);
  const em = (chunks: ReactNode) => <em>{chunks}</em>;

  return (
    <DressingFavorites next={route}>
      <div className="hp">
        {/* 1. L'accroche : une phrase, deux choix, la recherche, et de vraies pièces en vitrine. */}
        <section className="hp-hero" aria-labelledby="hp-hero-title">
          <div className="hp-hero__text">
            <p className="hp-hero__kicker">{t("heroKicker")}</p>
            <h1 id="hp-hero-title" className="hp-hero__title">{t.rich("heroTitle", { em })}</h1>
            <p className="hp-hero__lead">{t("heroLead")}</p>
            <div className="hp-hero__ctas">
              <a href="#univers" className="hp-btn hp-btn--gold">{t("ctaDiscover")}</a>
              <Link href="/vendre" className="hp-btn hp-btn--ghost">{t("ctaSell")}</Link>
            </div>
            <form action={getPathname({ href: "/catalogue", locale })} role="search" className="hp-search">
              <Search className="size-[18px] shrink-0" aria-hidden="true" />
              <input type="search" name="q" placeholder={t("searchPlaceholder")} aria-label={t("searchLabel")} className="hp-search__input" />
              <button type="submit" className="hp-search__go">{t("searchSubmit")}</button>
            </form>
          </div>
          {data.heroPieces.length ? (
            <ul className="hp-hero__wall" aria-label={t("heroWallLabel")}>
              {data.heroPieces.map((piece, index) => (
                <li key={piece.id} className="hp-hero__frame" data-slot={index}>
                  <Link href={piece.href} className="hp-hero__photo">
                    <Image src={piece.imageUrl!} alt={piece.title} fill preload={index === 0} sizes="(min-width: 1024px) 20vw, 42vw" className="object-cover" />
                    <span className="luxe-price">{formatPrice(piece.priceMillimes, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <div className="hp-wrap">
          {/* 2. Les univers : de vraies catégories, une vraie photo quand il y en a une. */}
          {data.universes.length ? (
            <section id="univers" className="hp-section" aria-labelledby="hp-univers-title">
              <SectionHead id="hp-univers-title" kicker={t("universesKicker")} title={t.rich("universesTitle", { em })} />
              <ul className="hp-universes">
                {data.universes.map((universe) => {
                  const Icon = ICONS[universe.icon];
                  return (
                    <li key={universe.key} className="hp-universe" data-universe={universe.key}>
                      <Link href={universe.href} className="hp-universe__main">
                        <span className="hp-universe__media" aria-hidden="true">
                          {universe.imageUrl ? (
                            <Image src={universe.imageUrl} alt="" fill sizes="(min-width: 1024px) 24vw, 46vw" className="object-cover" />
                          ) : (
                            <Icon className="hp-universe__icon" strokeWidth={1.4} />
                          )}
                        </span>
                        <span className="hp-universe__name">{t(`universe.${universe.key}`)}</span>
                      </Link>
                      {universe.links.length ? (
                        <ul className="hp-universe__links">
                          {universe.links.map((link) => (
                            <li key={link.href}>
                              <Link href={link.href}>{link.label}</Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* 3. Les collections : chacune n'apparaît que si elle a des pièces. */}
          {data.collections.length ? (
            <section className="hp-section" aria-labelledby="hp-collections-title">
              <SectionHead id="hp-collections-title" kicker={t("collectionsKicker")} title={t.rich("collectionsTitle", { em })} />
              <CollectionTabs
                label={t("collectionsKicker")}
                tabs={data.collections.map((collection) => ({ key: collection.key, label: t(`collection.${collection.key}`), hint: t(`collectionHint.${collection.key}`) }))}
                panels={data.collections.map((collection) => (
                  <ul key={collection.key} className="hp-rail rail-scroll">
                    {collection.pieces.map((piece) => (
                      <li key={piece.id}>
                        <PieceCard piece={piece} sizes="(min-width: 1024px) 16rem, 44vw" />
                      </li>
                    ))}
                  </ul>
                ))}
              />
            </section>
          ) : null}
          {/* Les arrivages validés par l'administration (repris de l'ancien accueil). */}
          {data.arrivals.length ? (
            <section className="hp-section" aria-labelledby="hp-arrivals-title">
              <SectionHead id="hp-arrivals-title" kicker={t("arrivalsKicker")} title={home("arrivalsTitle")} link={{ href: "/boutiques", label: home("seeAll") }} />
              <ul className="lx-arrivals rail-scroll hp-scroll">
                {data.arrivals.map((arrival) => (
                  <li key={arrival.id}>
                    <ArrivalCard
                      arrival={arrival}
                      piecesLabel={home("shopPieces", { count: arrival.products.length })}
                      dateLabel={arrival.reviewedAt ? formatDate(arrival.reviewedAt, locale) : null}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* 4. Fripe Walk : les vignettes seulement, aucune vidéo chargée avant le clic. */}
        {data.walk.length ? (
          <section className="hp-walk" aria-labelledby="hp-walk-title">
            <div className="hp-wrap">
              <SectionHead id="hp-walk-title" kicker="Fripe Walk" title={t.rich("walkTitle", { em })} body={t("walkBody")} link={{ href: "/walk", label: t("walkAll") }} />
              <ul className="hp-reels rail-scroll">
                {data.walk.map((item) => (
                  <li key={item.id}>
                    <Link href={{ pathname: "/walk", query: { v: item.id } }} className="hp-reel">
                      <Image src={item.thumbnailUrl} alt="" fill sizes="11rem" className="object-cover" />
                      <span className="hp-reel__play" aria-hidden="true"><Play className="size-4 fill-current rtl:-scale-x-100" /></span>
                      <span className="hp-reel__text">
                        <span className="hp-reel__shop" dir="auto">{item.shopName}</span>
                        {item.fromMillimes !== null ? <span className="hp-reel__price">{t("from", { price: formatPrice(item.fromMillimes, locale) })}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <div className="hp-wrap">
          {/* 5. Les armoires du Vide-Dressing, comme des vitrines à visiter. */}
          {data.wardrobes.length ? (
            <section className="hp-section" aria-labelledby="hp-wardrobes-title">
              <SectionHead id="hp-wardrobes-title" kicker={t("wardrobesKicker")} title={t.rich("wardrobesTitle", { em })} link={{ href: "/vide-dressing", label: t("wardrobesAll") }} />
              <ul className="hp-wardrobes">
                {data.wardrobes.map((wardrobe) => (
                  <li key={wardrobe.sellerId}>
                    <Link href={`/vide-dressing/dressing/${wardrobe.sellerId}`} className="hp-wardrobe">
                      <span className="hp-wardrobe__rail" aria-hidden="true">
                        {wardrobe.previews.map((url) => (
                          <span key={url} className="hp-wardrobe__piece">
                            <Image src={url} alt="" fill sizes="7rem" className="object-cover" />
                          </span>
                        ))}
                      </span>
                      <span className="hp-wardrobe__name" dir="auto">{wardrobe.sellerName}</span>
                      <span className="hp-wardrobe__meta">
                        {[t("pieces", { count: wardrobe.count }), wardrobe.place].filter(Boolean).join(" · ")}
                      </span>
                      {wardrobe.brands.length ? <span className="hp-wardrobe__brands" dir="auto">{wardrobe.brands.join(" · ")}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Les friperies les plus fournies (repris de l'ancien accueil). */}
          {data.shops.length ? (
            <section className="hp-section" aria-labelledby="hp-shops-title">
              <SectionHead id="hp-shops-title" kicker={t("shopsKicker")} title={home("shopsTitle")} link={{ href: "/boutiques", label: home("seeAll") }} />
              <ul className="lx-shops rail-scroll hp-scroll">
                {data.shops.map((shop) => (
                  <li key={shop.id}>
                    <ShopCard name={shop.name} slug={shop.slug} logoPath={shop.logoPath} previews={shop.previews} meta={`${shop.city} · ${home("shopPieces", { count: shop.count })}`} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 6. Les dernières pièces, boutiques et particuliers mêlés. */}
          {data.latest.length ? (
            <section className="hp-section" aria-labelledby="hp-latest-title">
              <SectionHead id="hp-latest-title" kicker={t("latestKicker")} title={t.rich("latestTitle", { em })} body={t("latestBody")} link={{ href: "/catalogue", label: t("latestAll") }} />
              <ul className="hp-grid">
                {data.latest.map((piece) => (
                  <li key={`${piece.kind}-${piece.id}`}>
                    <PieceCard piece={piece} />
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="hp-section">
              <h2 className="hp-head__title">{t("emptyTitle")}</h2>
              <p className="hp-head__body">{t("emptyBody")}</p>
            </section>
          )}

          {/* L'atelier : les outils de FRIPE, repris de l'ancien accueil. */}
          <section className="hp-section" aria-labelledby="hp-atelier-title">
            <SectionHead id="hp-atelier-title" kicker={home("atelierLabel")} title={t.rich("atelierTitle", { em })} />
            <ul className="hp-tools">
              {(
                [
                  { href: "/chine", icon: Layers, title: home("rackTitle"), body: home("rackBody") },
                  { href: "/tenues/nouvelle", icon: DoorOpen, title: home("cabinTitle"), body: home("cabinBody") },
                  { href: "/stylist", icon: Sparkles, title: home("discoverStylist"), body: t("toolStylistBody") },
                  { href: "/lives", icon: Radio, title: home("livesTitle"), body: t("toolLivesBody") },
                ] as const
              ).map((tool) => (
                <li key={tool.href}>
                  <Link href={tool.href} className="hp-tool">
                    <tool.icon className="hp-tool__icon" strokeWidth={1.6} aria-hidden="true" />
                    <span className="hp-tool__title">{tool.title}</span>
                    <span className="hp-tool__body">{tool.body}</span>
                    <ArrowRight className="hp-tool__go size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* 7. Vendre : deux portes, des liens réels. */}
          <section className="hp-section hp-sell" aria-labelledby="hp-sell-title">
            <SectionHead id="hp-sell-title" kicker={t("sellKicker")} title={t.rich("sellTitle", { em })} body={t("sellBody")} />
            <div className="hp-sell__doors">
              {(
                [
                  { key: "person", icon: UserRound, href: "/compte/annonces/nouvelle" },
                  { key: "shop", icon: Store, href: "/vendeur/creer-boutique" },
                ] as const
              ).map((door) => (
                <div key={door.key} className="hp-door">
                  <door.icon className="hp-door__icon" strokeWidth={1.6} aria-hidden="true" />
                  <h3 className="hp-door__title">{t(`sell.${door.key}.title`)}</h3>
                  <ol className="hp-door__steps">
                    {[1, 2, 3].map((step) => (
                      <li key={step}>{t(`sell.${door.key}.step${step}`)}</li>
                    ))}
                  </ol>
                  <Link href={door.href} className="hp-btn hp-btn--ink">
                    {t(`sell.${door.key}.cta`)} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                </div>
              ))}
            </div>
            <Link href="/informations-vendeurs" className="hp-head__link hp-sell__more">
              {t("sellMore")} <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </DressingFavorites>
  );
}
