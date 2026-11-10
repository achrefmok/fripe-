import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { getLocations } from "@/features/shops/queries";
import { getPathname, Link } from "@/i18n/navigation";
import { getCategoryAttributes, searchMarketplace, searchVideDressing } from "../queries";
import { MARKET_PAGE_SIZE, parseMarketFilters, type ListingSection } from "../schemas";
import { MarketFiltersBar } from "./market-filters";
import { MarketGrid } from "./market-card";

// Chaque rubrique a sa matière, comme les univers de la mode : denim pour la Marketplace,
// garance pour le Vide-Dressing.
const THEMES: Record<ListingSection, CSSProperties> = {
  marketplace: { "--s-surface": "oklch(0.3 0.05 250)", "--s-ink": "oklch(0.96 0.015 85)" } as CSSProperties,
  vide_dressing: { "--s-surface": "oklch(0.36 0.09 22)", "--s-ink": "oklch(0.96 0.015 85)" } as CSSProperties,
};

export async function SectionBrowse({
  section,
  searchParams,
}: {
  section: ListingSection;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filters = parseMarketFilters(searchParams);
  const route = section === "marketplace" ? "/marketplace" : "/vide-dressing";
  const [result, locations, t, locale] = await Promise.all([
    section === "marketplace" ? searchMarketplace(filters) : searchVideDressing(filters),
    getLocations(),
    getTranslations("market"),
    getLocale(),
  ]);

  const { items, total, categories, scope } = result;
  const roots = categories.filter((category) => !category.parentId);
  const label = (option: { nameFr: string; nameAr: string }) => (locale === "ar" ? option.nameAr : option.nameFr);

  const root = scope?.root ?? null;
  const subcategories = root
    ? [root, ...categories.filter((category) => category.parentId === root.id)].map((category) => ({
        value: category.slug,
        nameFr: category.id === root.id ? `${category.nameFr} · ${t("allCategories")}` : category.nameFr,
        nameAr: category.id === root.id ? `${category.nameAr} · ${t("allCategories")}` : category.nameAr,
      }))
    : [];
  const attributes = section === "marketplace" && scope ? await getCategoryAttributes([scope.root.id, scope.selected.id]) : [];

  const basePath = getPathname({ href: route, locale });
  const pages = Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE));
  const pageHref = (page: number) => ({
    pathname: route,
    query: Object.fromEntries(
      Object.entries({ ...searchParams, page: String(page) }).filter(([, value]) => typeof value === "string" && value !== ""),
    ) as Record<string, string>,
  });

  const title = section === "marketplace" ? t("marketplaceTitle") : t("videDressingTitle");
  const heading = scope ? label(scope.selected) : title;

  return (
    <>
      <header className="section-band" style={THEMES[section]}>
        <div className="section-band__inner">
          {scope ? (
            <Link href={route} className="text-sm font-semibold underline underline-offset-4">
              {title}
            </Link>
          ) : null}
          <p className="section-band__kicker">{section === "marketplace" ? t("marketplaceKicker") : t("videDressingKicker")}</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="section-band__title">{heading}</h1>
            <Link href={`/compte/annonces/nouvelle?rubrique=${section}`} className="section-band__cta">
              <Plus className="size-4" aria-hidden="true" />
              {t("publish")}
            </Link>
          </div>
          {!scope ? (
            <p className="mt-3 max-w-xl text-base leading-relaxed md:text-lg">
              {section === "marketplace" ? t("marketplaceBody") : t("videDressingBody")}
            </p>
          ) : null}

          <nav aria-label={t("category")} className="rail-scroll -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
            <Link href={route} className="section-chip" aria-current={!scope ? "page" : undefined}>
              {t("allCategories")}
            </Link>
            {roots.map((category) => (
              <Link
                key={category.id}
                href={{ pathname: route, query: { categorie: category.slug } }}
                className="section-chip"
                aria-current={scope?.root.id === category.id ? "page" : undefined}
              >
                {label(category)}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 pt-5 pb-24 md:px-6 md:pb-16">
        <MarketFiltersBar
          section={section}
          basePath={basePath}
          filters={filters}
          subcategories={subcategories}
          attributes={attributes}
          governorates={locations.map((governorate) => ({
            value: String(governorate.id),
            nameFr: governorate.nameFr,
            nameAr: governorate.nameAr,
          }))}
        />

        <p className="mt-5 mb-4 text-sm font-semibold" role="status">
          {t("results", { count: total })}
        </p>

        {items.length ? (
          <MarketGrid items={items} />
        ) : (
          <div className="border-t-2 border-foreground/80 py-10">
            <h2 className="font-display text-2xl font-extrabold">
              {filters.q || filters.categorie || Object.keys(filters.attributes).length ? t("emptyTitle") : t("emptySectionTitle")}
            </h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              {filters.q || filters.categorie || Object.keys(filters.attributes).length ? t("emptyBody") : t("emptySectionBody")}
            </p>
          </div>
        )}

        {pages > 1 ? (
          <nav className="mt-10 flex items-center justify-between gap-4" aria-label={t("pageOf", { page: filters.page, pages })}>
            {filters.page > 1 ? (
              <Link href={pageHref(filters.page - 1)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                {t("previousPage")}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-muted-foreground">{t("pageOf", { page: filters.page, pages })}</span>
            {filters.page < pages ? (
              <Link href={pageHref(filters.page + 1)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                {t("nextPage")}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </>
  );
}
