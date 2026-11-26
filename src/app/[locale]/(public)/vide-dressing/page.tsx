import { ArrowRight, X } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import { DressingGrid } from "@/features/dressing/components/dressing-card";
import { DressingStories } from "@/features/dressing/components/dressing-stories";
import { DressingFavorites } from "@/features/dressing/components/favorites";
import { PiecesView } from "@/features/dressing/components/pieces-view";
import { VdHero } from "@/features/dressing/components/vd-hero";
import { VdTicker } from "@/features/dressing/components/vd-ticker";
import { getDressingOverview, searchDressing } from "@/features/dressing/queries";
import { dressingFirstName } from "@/features/dressing/tone";
import { MarketFiltersBar } from "@/features/marketplace/components/market-filters";
import { MARKET_PAGE_SIZE, parseMarketFilters } from "@/features/marketplace/schemas";
import { getLocations } from "@/features/shops/queries";
import { getPathname, Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";
import { formatPrice, parsePriceToMillimes } from "@/lib/utils/price";
import { subcategoriesOf } from "@/features/catalog/category-scope";
import { AUDIENCES } from "@/features/catalog/audience";

const ROUTE = "/vide-dressing";
const SELL = "/compte/annonces/nouvelle?rubrique=vide_dressing";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("videDressingTitle"), description: t("videDressingBody") };
}

export default async function VideDressingPage({ params, searchParams }: PageProps<"/[locale]/vide-dressing">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const raw = await searchParams;
  const filters = parseMarketFilters(raw);
  const [result, overview, locations, t, market, conditions, audience] = await Promise.all([
    searchDressing(filters),
    getDressingOverview(),
    getLocations(),
    getTranslations("dressing"),
    getTranslations("market"),
    getTranslations("conditions"),
    getTranslations("audience"),
  ]);

  const { items, total, categories, scope } = result;
  const roots = categories.filter((category) => !category.parentId);
  const label = (option: { nameFr: string; nameAr: string }) => (locale === "ar" ? option.nameAr : option.nameFr);

  // Les valeurs actives, telles qu'elles voyagent dans l'adresse.
  const active: Record<string, string> = Object.fromEntries(
    Object.entries({
      q: filters.q,
      categorie: filters.categorie,
      pour: filters.pour ?? "",
      marque: filters.marque,
      taille: filters.taille,
      etat: filters.etat ?? "",
      gouvernorat: filters.gouvernorat,
      prixMin: filters.prixMin,
      prixMax: filters.prixMax,
      tri: filters.tri === "recent" ? "" : filters.tri,
    }).filter(([, value]) => value),
  );
  const filtering = Object.keys(active).some((key) => key !== "tri");
  const browsing = !filtering && filters.page === 1;

  // Un lien qui pose, change ou retire des filtres sans perdre les autres ; la page repart de 1.
  const href = (changes: Record<string, string>) => {
    const query = Object.fromEntries(Object.entries({ ...active, ...changes }).filter(([, value]) => value));
    return { pathname: ROUTE, query };
  };
  const toggle = (key: string, value: string) => href({ [key]: active[key]?.toLocaleLowerCase() === value.toLocaleLowerCase() ? "" : value });
  const isOn = (key: string, value: string) => active[key]?.toLocaleLowerCase() === value.toLocaleLowerCase();

  const root = scope?.root ?? null;
  const subcategories = root
    ? [root, ...subcategoriesOf(categories, root)].map((category) => ({
        value: category.slug,
        nameFr: category.id === root.id ? `${category.nameFr} · ${market("allCategories")}` : category.nameFr,
        nameAr: category.id === root.id ? `${category.nameAr} · ${market("allCategories")}` : category.nameAr,
      }))
    : [];

  const governorate = locations.find((entry) => String(entry.id) === filters.gouvernorat);
  type Chip = { key: string; label: string; changes: Record<string, string> };
  const chips: (Chip | null)[] = [
    filters.q ? { key: "q", label: `« ${filters.q} »`, changes: { q: "" } } : null,
    scope ? { key: "categorie", label: label(scope.selected), changes: { categorie: "" } } : null,
    filters.pour ? { key: "pour", label: audience("chip", { audience: audience(filters.pour) }), changes: { pour: "" } } : null,
    filters.marque ? { key: "marque", label: filters.marque, changes: { marque: "" } } : null,
    filters.taille ? { key: "taille", label: t("sizeShort", { size: filters.taille }), changes: { taille: "" } } : null,
    filters.etat ? { key: "etat", label: conditions(filters.etat), changes: { etat: "" } } : null,
    governorate ? { key: "gouvernorat", label: label(governorate), changes: { gouvernorat: "" } } : null,
    filters.prixMin || filters.prixMax
      ? {
          key: "prix",
          label: [
            filters.prixMin && `≥ ${formatPrice(parsePriceToMillimes(filters.prixMin) ?? 0, locale)}`,
            filters.prixMax && `≤ ${formatPrice(parsePriceToMillimes(filters.prixMax) ?? 0, locale)}`,
          ]
            .filter(Boolean)
            .join(" · "),
          changes: { prixMin: "", prixMax: "" },
        }
      : null,
  ];
  const activeChips = chips.filter((chip): chip is Chip => chip !== null);

  const pages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE));
  const pageHref = (page: number) => ({ pathname: ROUTE, query: { ...active, ...(page > 1 ? { page: String(page) } : {}) } });
  const next = getPathname({ href: ROUTE, locale });

  // Le dressing le plus garni ouvre ses portes dans le héros, et sert d'exemple pour composer un lot.
  const star = overview.dressings[0] ?? null;
  const starName = star ? dressingFirstName(star.sellerName) : "";
  const ticker = overview.latest.map((item) => ({
    id: item.id,
    text: t("tickerAdded", { name: dressingFirstName(item.sellerName), title: item.title, price: formatPrice(item.priceMillimes, locale) }),
  }));

  // Chiner par envie : quatre portes d'entrée, chacune un filtre ou un mode.
  const moods = [
    { key: "budget", kicker: t("moodBudgetKicker"), title: t("moodBudget", { amount: 30 }), href: { ...href({ prixMin: "", prixMax: "30" }), hash: "pieces" } },
    { key: "new", kicker: t("moodNewKicker"), title: t("moodNew"), href: { ...href({ etat: "new_with_tags" }), hash: "pieces" } },
    { key: "fine", kicker: t("moodFineKicker"), title: t("moodFine", { amount: 80 }), href: { ...href({ prixMin: "80", prixMax: "" }), hash: "pieces" } },
    { key: "crush", kicker: t("moodCrushKicker"), title: t("moodCrush"), href: "/vide-dressing/coup-de-foudre" },
  ];

  return (
    <DressingFavorites next={ROUTE}>
      {browsing ? <VdTicker label={t("tickerLabel")} entries={ticker} /> : null}
      <div className="vd-page">
        {browsing ? (
          <VdHero
            kicker={t("kicker")}
            title={t.rich("heroTitle", { em: (chunks) => <em>{chunks}</em> })}
            lead={t("heroLead")}
            explore={t("explore")}
            crush={t("crushMode")}
            perks={{ offer: t("perkOffer"), lot: t("perkLot"), crush: t("perkCrush") }}
            doorsLabel={t("closetDoors")}
            closet={
              star
                ? {
                    sellerId: star.sellerId,
                    sign: [t("dressingOf", { name: starName }), star.place ? localizedName(star.place, locale) : null].filter(Boolean).join(" · "),
                    enter: t("enterDressing", { name: starName }),
                    pieces: star.pieces,
                  }
                : null
            }
          />
        ) : (
          <header className="vd-band">
            <Link href={ROUTE} className="vd-band__back">{t("backToAll")}</Link>
            <p className="vd-hero__kicker">{t("kicker")}</p>
            <h1 className="vd-band__title">{scope ? label(scope.selected) : t("resultsTitle")}</h1>
          </header>
        )}

        {browsing && overview.dressings.length ? (
          <section id="dressings" className="vd-section vd-scene scroll-mt-24" aria-labelledby="vd-dressings">
            <div className="vd-section__head">
              <h2 id="vd-dressings" className="vd-section__title">{t("dayTitle")}</h2>
              <p className="vd-section__lead">{t("dayLead")}</p>
            </div>
            <DressingStories dressings={overview.dressings} sellHref={SELL} />
          </section>
        ) : null}

        {browsing ? (
          <section className="vd-section vd-scene" aria-labelledby="vd-moods">
            <h2 id="vd-moods" className="vd-section__title">{t("exploreTitle")}</h2>
            <ul className="vd-moods">
              {moods.map((mood, index) => (
                <li key={mood.key} style={{ "--i": index } as CSSProperties}>
                  <Link href={mood.href} className={`vd-mood vd-mood--${mood.key}`}>
                    <span className="vd-mood__kicker">{mood.kicker}</span>
                    <span className="vd-mood__title">{mood.title}</span>
                    <ArrowRight className="vd-mood__arrow rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            {overview.brands.length || overview.sizes.length ? (
              <dl className="vd-explore">
                {overview.brands.length ? (
                  <div className="vd-explore__row">
                    <dt>{t("brandsTitle")}</dt>
                    <dd>
                      {overview.brands.map((brand) => (
                        <Link
                          key={brand.label}
                          href={{ ...toggle("marque", brand.label), hash: "pieces" }}
                          className="vd-chip vd-chip--brand"
                          aria-current={isOn("marque", brand.label) ? "true" : undefined}
                        >
                          <span dir="auto">{brand.label}</span>
                          <span className="vd-chip__count">{brand.count}</span>
                        </Link>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {overview.sizes.length ? (
                  <div className="vd-explore__row">
                    <dt>{t("sizesTitle")}</dt>
                    <dd>
                      {overview.sizes.map((size) => (
                        <Link
                          key={size.label}
                          href={{ ...toggle("taille", size.label), hash: "pieces" }}
                          className="vd-chip"
                          aria-current={isOn("taille", size.label) ? "true" : undefined}
                        >
                          <span dir="ltr">{size.label}</span>
                        </Link>
                      ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </section>
        ) : null}

        <section id="pieces" className="vd-section vd-scene scroll-mt-24" aria-labelledby="vd-all">
          <div className="vd-section__head">
            <h2 id="vd-all" className="vd-section__title">{filtering ? t("resultsTitle") : t("allTitle")}</h2>
            <p className="vd-section__lead" role="status">{market("results", { count: total })}</p>
          </div>

          <nav aria-label={t("categoriesLabel")} className="vd-cats rail-scroll">
            <Link href={href({ categorie: "" })} className="vd-chip" aria-current={!scope ? "page" : undefined}>
              {market("allCategories")}
            </Link>
            {roots.map((category) => (
              <Link key={category.id} href={href({ categorie: category.slug })} className="vd-chip" aria-current={scope?.root.id === category.id ? "page" : undefined}>
                {label(category)}
              </Link>
            ))}
          </nav>

          {/* Pour qui : Femme, Homme, Enfant. Une pièce mixte convient à une femme comme à un homme. */}
          <nav aria-label={audience("label")} className="vd-cats rail-scroll mt-2">
            <Link href={href({ pour: "" })} className="vd-chip" aria-current={!filters.pour ? "page" : undefined}>
              {audience("all")}
            </Link>
            {AUDIENCES.map((value) => (
              <Link key={value} href={href({ pour: value })} className="vd-chip" aria-current={filters.pour === value ? "page" : undefined}>
                {audience(value)}
              </Link>
            ))}
          </nav>

          <div className="mt-4">
            <MarketFiltersBar
              section="vide_dressing"
              basePath={next}
              filters={filters}
              subcategories={subcategories}
              attributes={[]}
              governorates={locations.map((entry) => ({ value: String(entry.id), nameFr: entry.nameFr, nameAr: entry.nameAr }))}
            />
          </div>

          {activeChips.length ? (
            <ul className="mt-3.5 flex flex-wrap items-center gap-2" aria-label={t("activeLabel")}>
              {activeChips.map((chip) => (
                <li key={chip.key}>
                  <Link href={href(chip.changes)} className="vd-active" aria-label={t("removeFilter", { label: chip.label })}>
                    <span dir="auto">{chip.label}</span>
                    <X className="size-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
              <li>
                <Link href={ROUTE} className="inline-flex min-h-9 items-center px-1 text-sm font-medium underline underline-offset-4">
                  {t("clear")}
                </Link>
              </li>
            </ul>
          ) : null}

          {items.length ? (
            <PiecesView>
              {/* La clé rejoue l'entrée des cartes à chaque changement de filtre ou de catégorie. */}
              <DressingGrid key={JSON.stringify(active) + filters.page} items={items} />
            </PiecesView>
          ) : (
            <div className="vd-empty mt-6">
              <h3 className="font-display text-2xl">{filtering ? market("emptyTitle") : market("emptySectionTitle")}</h3>
              <p className="mt-2 max-w-md text-muted-foreground">{filtering ? market("emptyBody") : market("emptySectionBody")}</p>
            </div>
          )}

          {pages > 1 ? (
            <nav className="mt-10 flex items-center justify-between gap-4" aria-label={market("pageOf", { page: filters.page, pages })}>
              {filters.page > 1 ? <Link href={pageHref(filters.page - 1)} className="vd-chip">{market("previousPage")}</Link> : <span />}
              <span className="text-sm text-muted-foreground">{market("pageOf", { page: filters.page, pages })}</span>
              {filters.page < pages ? <Link href={pageHref(filters.page + 1)} className="vd-chip">{market("nextPage")}</Link> : <span />}
            </nav>
          ) : null}
        </section>

        {browsing && star ? (
          <section className="vd-lotband vd-scene" aria-labelledby="vd-lotband">
            <div className="vd-lotband__text">
              <p className="vd-lot__kicker">{t("lotKicker")}</p>
              <h2 id="vd-lotband" className="vd-lotband__title">{t.rich("lotTitle", { em: (chunks) => <em>{chunks}</em> })}</h2>
              <p className="vd-lotband__body">{t("lotBody")}</p>
            </div>
            <div className="vd-lotband__side">
              <ol className="vd-lotband__steps">
                {[t("lotStep1"), t("lotStep2"), t("lotStep3")].map((step, index) => (
                  <li key={step} style={{ "--i": index } as CSSProperties}>
                    <span className="vd-lotband__num" aria-hidden="true">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <Link href={`/vide-dressing/dressing/${star.sellerId}`} className="vd-lot__cta">
                {t("lotCta", { name: starName })}
              </Link>
            </div>
          </section>
        ) : null}

        {browsing ? (
          <section className="vd-sell vd-scene" aria-labelledby="vd-sell">
            <div className="vd-sell__head">
              <h2 id="vd-sell" className="vd-sell__title">{t.rich("sellTitle", { em: (chunks) => <em>{chunks}</em> })}</h2>
              <Link href={SELL} className="vd-hero__cta vd-hero__cta--cream">{t("sell")}</Link>
            </div>
            <ol className="vd-sell__steps">
              {[
                [t("sellStep1Title"), t("sellStep1")],
                [t("sellStep2Title"), t("sellStep2")],
                [t("sellStep3Title"), t("sellStep3")],
              ].map(([title, body], index) => (
                <li key={title} style={{ "--i": index } as CSSProperties}>
                  <span className="vd-sell__num" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="vd-sell__step">{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </DressingFavorites>
  );
}
