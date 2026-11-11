import { X } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CONDITIONS } from "@/features/catalog/constants";
import { DressingGrid, DressingRail } from "@/features/dressing/components/dressing-card";
import { DressingTile } from "@/features/dressing/components/dressing-tile";
import { DressingFavorites } from "@/features/dressing/components/favorites";
import { VdHero } from "@/features/dressing/components/vd-hero";
import { getDressingOverview, searchDressing } from "@/features/dressing/queries";
import { MarketFiltersBar } from "@/features/marketplace/components/market-filters";
import { MARKET_PAGE_SIZE, parseMarketFilters } from "@/features/marketplace/schemas";
import { getLocations } from "@/features/shops/queries";
import { getPathname, Link } from "@/i18n/navigation";

const ROUTE = "/vide-dressing";

// Trois tranches de prix, en dinars : la petite trouvaille, le cœur du marché, la belle pièce.
const PRICE_BANDS = [
  { key: "under", min: "", max: "30" },
  { key: "between", min: "30", max: "80" },
  { key: "over", min: "80", max: "" },
] as const;

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("videDressingTitle"), description: t("videDressingBody") };
}

export default async function VideDressingPage({ params, searchParams }: PageProps<"/[locale]/vide-dressing">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const raw = await searchParams;
  const filters = parseMarketFilters(raw);
  const [result, overview, locations, t, market, conditions] = await Promise.all([
    searchDressing(filters),
    getDressingOverview(),
    getLocations(),
    getTranslations("dressing"),
    getTranslations("market"),
    getTranslations("conditions"),
  ]);

  const { items, total, categories, scope } = result;
  const roots = categories.filter((category) => !category.parentId);
  const label = (option: { nameFr: string; nameAr: string }) => (locale === "ar" ? option.nameAr : option.nameFr);

  // Les valeurs actives, telles qu'elles voyagent dans l'adresse.
  const active: Record<string, string> = Object.fromEntries(
    Object.entries({
      q: filters.q,
      categorie: filters.categorie,
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
  const bandOn = (band: (typeof PRICE_BANDS)[number]) => (active.prixMin ?? "") === band.min && (active.prixMax ?? "") === band.max;
  const bandLabel = (band: (typeof PRICE_BANDS)[number]) =>
    band.key === "under"
      ? t("priceUnder", { amount: band.max })
      : band.key === "over"
        ? t("priceOver", { amount: band.min })
        : t("priceBetween", { min: band.min, max: band.max });

  const root = scope?.root ?? null;
  const subcategories = root
    ? [root, ...categories.filter((category) => category.parentId === root.id)].map((category) => ({
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
    filters.marque ? { key: "marque", label: filters.marque, changes: { marque: "" } } : null,
    filters.taille ? { key: "taille", label: t("sizeShort", { size: filters.taille }), changes: { taille: "" } } : null,
    filters.etat ? { key: "etat", label: conditions(filters.etat), changes: { etat: "" } } : null,
    governorate ? { key: "gouvernorat", label: label(governorate), changes: { gouvernorat: "" } } : null,
    filters.prixMin || filters.prixMax
      ? {
          key: "prix",
          label: [filters.prixMin && `≥ ${filters.prixMin} DT`, filters.prixMax && `≤ ${filters.prixMax} DT`].filter(Boolean).join(" · "),
          changes: { prixMin: "", prixMax: "" },
        }
      : null,
  ];
  const activeChips = chips.filter((chip): chip is Chip => chip !== null);

  const pages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE));
  const pageHref = (page: number) => ({ pathname: ROUTE, query: { ...active, ...(page > 1 ? { page: String(page) } : {}) } });
  const next = getPathname({ href: ROUTE, locale });

  return (
    <DressingFavorites next={ROUTE}>
      <div className="vd-page">
        {browsing ? (
          <VdHero
            kicker={t("kicker")}
            title={t.rich("heroTitle", { em: (chunks) => <em>{chunks}</em> })}
            lead={t("heroLead")}
            sell={t("sell")}
            discover={t("discover")}
            stat={t("stat", { count: total })}
            photos={overview.latest.flatMap((item) => item.imageUrl ?? [])}
          />
        ) : (
          <header className="vd-band">
            <Link href={ROUTE} className="vd-band__back">{t("backToAll")}</Link>
            <p className="vd-hero__kicker">{t("kicker")}</p>
            <h1 className="vd-band__title">{scope ? label(scope.selected) : t("resultsTitle")}</h1>
          </header>
        )}

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

        {browsing && overview.dressings.length ? (
          <section id="dressings" className="vd-section" aria-labelledby="vd-dressings">
            <div className="vd-section__head">
              <h2 id="vd-dressings" className="vd-section__title">{t("dressingsTitle")}</h2>
              <p className="vd-section__lead">{t("dressingsLead")}</p>
            </div>
            <ul className="vd-tiles rail-scroll">
              {overview.dressings.map((dressing, index) => (
                <li key={dressing.sellerId}>
                  <DressingTile dressing={dressing} index={index} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="vd-section" aria-labelledby="vd-explore">
          <h2 id="vd-explore" className="vd-section__title">{t("exploreTitle")}</h2>
          <dl className="vd-explore">
            {overview.brands.length ? (
              <div className="vd-explore__row">
                <dt>{t("brandsTitle")}</dt>
                <dd>
                  {overview.brands.map((brand) => (
                    <Link key={brand.label} href={toggle("marque", brand.label)} className="vd-chip vd-chip--brand" aria-current={isOn("marque", brand.label) ? "true" : undefined}>
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
                    <Link key={size.label} href={toggle("taille", size.label)} className="vd-chip" aria-current={isOn("taille", size.label) ? "true" : undefined}>
                      <span dir="ltr">{size.label}</span>
                    </Link>
                  ))}
                </dd>
              </div>
            ) : null}
            <div className="vd-explore__row">
              <dt>{t("conditionTitle")}</dt>
              <dd>
                {CONDITIONS.map((condition) => (
                  <Link key={condition} href={toggle("etat", condition)} className="vd-chip" aria-current={isOn("etat", condition) ? "true" : undefined}>
                    {conditions(condition)}
                  </Link>
                ))}
              </dd>
            </div>
            <div className="vd-explore__row">
              <dt>{t("priceTitle")}</dt>
              <dd>
                {PRICE_BANDS.map((band) => (
                  <Link
                    key={band.key}
                    href={href(bandOn(band) ? { prixMin: "", prixMax: "" } : { prixMin: band.min, prixMax: band.max })}
                    className="vd-chip"
                    aria-current={bandOn(band) ? "true" : undefined}
                  >
                    {bandLabel(band)}
                  </Link>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        {browsing && overview.deals.length >= 3 ? (
          <section className="vd-section" aria-labelledby="vd-deals">
            <div className="vd-section__head">
              <h2 id="vd-deals" className="vd-section__title">{t("dealsTitle")}</h2>
              <p className="vd-section__lead">{t("dealsLead")}</p>
            </div>
            <DressingRail items={overview.deals} label={t("dealsTitle")} />
          </section>
        ) : null}

        {browsing && overview.branded.length >= 3 ? (
          <section className="vd-section" aria-labelledby="vd-branded">
            <div className="vd-section__head">
              <h2 id="vd-branded" className="vd-section__title">{t("brandedTitle")}</h2>
              <p className="vd-section__lead">{t("brandedLead")}</p>
            </div>
            <DressingRail items={overview.branded} label={t("brandedTitle")} />
          </section>
        ) : null}

        <section className="vd-section" aria-labelledby="vd-all">
          <div className="vd-section__head">
            <h2 id="vd-all" className="vd-section__title">{filtering ? t("resultsTitle") : t("allTitle")}</h2>
            <p className="vd-section__lead" role="status">{market("results", { count: total })}</p>
          </div>

          {items.length ? (
            // La clé rejoue l'entrée des cartes à chaque changement de filtre ou de catégorie.
            <DressingGrid key={JSON.stringify(active) + filters.page} items={items} />
          ) : (
            <div className="vd-empty">
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
      </div>
    </DressingFavorites>
  );
}
