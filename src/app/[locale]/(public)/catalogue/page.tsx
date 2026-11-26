import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/features/admin/components/pagination";
import { AUDIENCES } from "@/features/catalog/audience";
import { CatalogFiltersForm } from "@/features/catalog/components/catalog-filters";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/constants";
import { getCategories, searchProducts } from "@/features/catalog/queries";
import { catalogFiltersSchema } from "@/features/catalog/schemas";
import { Garment } from "@/features/home/components/garment";
import { universeFor } from "@/features/home/universes";
import { getLocations } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { subcategoriesOf } from "@/features/catalog/category-scope";
import { PieceCard } from "@/features/home/preview/piece-card";
import { fromProduct } from "@/features/home/preview/queries";

export async function generateMetadata() {
  const t = await getTranslations("catalog");
  return { title: t("title") };
}

export default async function CataloguePage({ searchParams }: PageProps<"/[locale]/catalogue">) {
  const filters = catalogFiltersSchema.parse(await searchParams);

  const [{ products, total }, categories, locations, t, audience, locale] = await Promise.all([
    searchProducts(filters),
    getCategories(),
    getLocations(),
    getTranslations("catalog"),
    getTranslations("audience"),
    getLocale(),
  ]);

  // Une sous-catégorie reste dans l'univers de sa catégorie racine.
  const selected = categories.find((category) => category.slug === filters.categorie);
  const root = categories.find((category) => category.id === selected?.parentId) ?? selected;
  const universe = root ? universeFor(root.slug) : null;

  const { page, ...rest } = filters;
  const hasCriteria = Object.entries(rest).some(([key, value]) => key !== "tri" && value);
  const params = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value),
  ) as Record<string, string>;

  const roots = categories.filter((category) => !category.parentId);
  const name = (category: { nameFr: string; nameAr: string }) => (locale === "ar" ? category.nameAr : category.nameFr);
  // Sous « Chaussures », le bandeau annonce aussi Sneakers : les baskets y sont incluses.
  const subs = root ? subcategoriesOf(categories, root).map(name) : [];
  const chipHref = (slug: string | null) => ({ pathname: "/catalogue" as const, query: { ...params, categorie: slug ?? undefined, page: undefined } });

  return (
    <div className="mx-auto max-w-[1200px] px-[18px] pb-24 pt-[18px] md:pb-16">
      {/* Friptex Luxe : le bandeau de l'univers, son vêtement qui se balance au cintre. */}
      <header
        className="lx-band"
        style={universe ? ({ "--u-surface": universe.surface, "--u-ink": universe.ink } as CSSProperties) : undefined}
      >
        <div className="min-w-0 flex-1">
          <p className="lx-band__kicker">{t("bandKicker", { count: total })}</p>
          <h1 className="lx-band__title">{selected ? name(selected) : t("allTitle")}</h1>
          <p className="lx-band__subs">{subs.length ? subs.join(locale === "ar" ? "، " : ", ") : t("allSubs")}</p>
        </div>
        <Garment universe={universe ?? universeFor("tout")} className="lx-band__garment" />
      </header>

      <nav aria-label={t("categoriesLabel")} className="lx-chips rail-scroll">
        <Link href={chipHref(null)} aria-current={selected ? undefined : "page"} className="lx-chip">
          {t("all")}
        </Link>
        {roots.map((category) => (
          <Link key={category.id} href={chipHref(category.slug)} aria-current={root?.id === category.id ? "page" : undefined} className="lx-chip">
            {name(category)}
          </Link>
        ))}
      </nav>

      {/* Pour qui : Femme, Homme, Enfant. Les pièces mixtes apparaissent pour une femme comme pour un homme. */}
      <nav aria-label={audience("label")} className="lx-quick">
        <span className="text-muted-foreground">{audience("short")}</span>
        {(["", ...AUDIENCES] as const).map((value) => (
          <Link
            key={value || "tous"}
            href={{ pathname: "/catalogue", query: { ...params, pour: value || undefined, page: undefined } }}
            aria-current={(filters.pour ?? "") === value ? "true" : undefined}
            className="lx-quick__link"
          >
            {value ? audience(value) : audience("all")}
          </Link>
        ))}
      </nav>

      {/* Les réglages rapides, soulignés d'or : la taille et l'ordre. */}
      <div className="lx-quick">
        <span className="text-muted-foreground">{t("size")}</span>
        {["", "S", "M", "L", "38", "41"].map((size) => (
          <Link
            key={size || "toutes"}
            href={{ pathname: "/catalogue", query: { ...params, taille: size || undefined, page: undefined } }}
            aria-current={(filters.taille ?? "") === size ? "true" : undefined}
            className="lx-quick__link"
          >
            {size || t("allSizes")}
          </Link>
        ))}
        <span className="ms-auto flex flex-wrap items-center gap-3">
          <span className="text-muted-foreground">{t("sort")}</span>
          {(["recent", "popular", "price_asc", "price_desc"] as const).map((sort) => (
            <Link
              key={sort}
              href={{ pathname: "/catalogue", query: { ...params, tri: sort, page: undefined } }}
              aria-current={filters.tri === sort ? "true" : undefined}
              className="lx-quick__link"
            >
              {t(sort === "recent" ? "sortRecentShort" : sort === "popular" ? "sortPopularShort" : sort === "price_asc" ? "sortAscShort" : "sortDescShort")}
            </Link>
          ))}
        </span>
      </div>

      <div className="mt-2">
        <CatalogFiltersForm
          filters={filters}
          categories={roots.map((category) => ({ value: category.slug, nameFr: category.nameFr, nameAr: category.nameAr }))}
          governorates={locations.map((location) => ({
            value: String(location.id),
            nameFr: location.nameFr,
            nameAr: location.nameAr,
          }))}
        />
      </div>

      <p role="status" className="mt-5 text-sm text-muted-foreground">
        {t("results", { count: total })}
      </p>

      <div className="mt-3">
        {products.length ? (
          // La carte unique : état, taille, boutique, favori et disponibilité sur chaque pièce.
          <ul className="luxe-grid">
            {products.map((product) => (
              <li key={product.id}>
                <PieceCard piece={fromProduct(product)} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={hasCriteria ? t("emptyTitle") : t("emptyCatalogTitle")}
            body={hasCriteria ? t("emptyBody") : t("emptyCatalogBody")}
          />
        )}
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={CATALOG_PAGE_SIZE}
        basePath="/catalogue"
        params={params}
      />
    </div>
  );
}
