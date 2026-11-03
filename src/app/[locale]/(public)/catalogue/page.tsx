import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/features/admin/components/pagination";
import { CatalogFiltersForm } from "@/features/catalog/components/catalog-filters";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/constants";
import { getCategories, searchProducts } from "@/features/catalog/queries";
import { catalogFiltersSchema } from "@/features/catalog/schemas";
import { Garment } from "@/features/home/components/garment";
import { universeFor } from "@/features/home/universes";
import { getLocations } from "@/features/shops/queries";

export async function generateMetadata() {
  const t = await getTranslations("catalog");
  return { title: t("title") };
}

export default async function CataloguePage({ searchParams }: PageProps<"/[locale]/catalogue">) {
  const filters = catalogFiltersSchema.parse(await searchParams);

  const [{ products, total }, categories, locations, t, locale] = await Promise.all([
    searchProducts(filters),
    getCategories(),
    getLocations(),
    getTranslations("catalog"),
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

  return (
    <>
      {selected && universe ? (
        <header
          className="universe-band"
          style={{ "--u-surface": universe.surface, "--u-ink": universe.ink } as CSSProperties}
        >
          <div className="mx-auto flex max-w-7xl items-end justify-between gap-4 px-4 md:px-6">
            <h1 className="universe-band__title">{locale === "ar" ? selected.nameAr : selected.nameFr}</h1>
            <Garment universe={universe} className="universe-band__garment" />
          </div>
        </header>
      ) : null}

      <div className={`mx-auto max-w-7xl px-4 pb-24 md:px-6 md:pb-16 ${universe ? "pt-4" : "pt-6 md:pt-10"}`}>
      {universe ? null : <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>}

      <div className="mt-4">
        <CatalogFiltersForm
          filters={filters}
          categories={categories
            .filter((category) => !category.parentId)
            .map((category) => ({ value: category.slug, nameFr: category.nameFr, nameAr: category.nameAr }))}
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
          <ProductGrid products={products} />
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
    </>
  );
}
