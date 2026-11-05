import { Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Pagination } from "@/features/admin/components/pagination";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/constants";
import { listPublicShops, listShopGovernorates } from "@/features/catalog/queries";
import { ShopTile } from "@/features/shops/components/shop-tile";
import { getPathname, Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";

export async function generateMetadata() {
  const t = await getTranslations("shopPublic");
  return { title: t("title"), description: t("lead") };
}

export default async function ShopsPage({ searchParams }: PageProps<"/[locale]/boutiques">) {
  const { page, q, gouvernorat } = await searchParams;
  const currentPage = Math.max(Number(page) || 1, 1);
  const search = typeof q === "string" ? q.trim().slice(0, 60) : "";
  const governorateId = Number(gouvernorat) > 0 ? Number(gouvernorat) : undefined;
  const filtered = Boolean(search || governorateId);

  const [{ shops, total }, governorates, t, locale] = await Promise.all([
    listPublicShops(currentPage, { q: search, governorateId }),
    listShopGovernorates(),
    getTranslations("shopPublic"),
    getLocale(),
  ]);

  const params: Record<string, string> = {};
  if (search) params.q = search;
  if (governorateId) params.gouvernorat = String(governorateId);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-10">
      <header className="shops-head">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-extrabold text-balance md:text-6xl">{t("title")}</h1>
          <p className="mt-3 max-w-xl text-pretty leading-relaxed text-muted-foreground md:text-lg">{t("lead")}</p>
        </div>

        <form action={getPathname({ href: "/boutiques", locale })} className="shops-filter" role="search">
          <label className="shops-filter__search grid min-w-0 flex-1 gap-1">
            <span className="text-sm font-semibold">{t("searchLabel")}</span>
            <span className="relative">
              <Search className="pointer-events-none absolute start-0 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                name="q"
                defaultValue={search}
                maxLength={60}
                placeholder={t("searchPlaceholder")}
                autoComplete="off"
                className="field-line h-12 ps-6"
              />
            </span>
          </label>
          {governorates.length > 1 ? (
            <label className="grid min-w-0 gap-1 sm:w-56">
              <span className="text-sm font-semibold">{t("governorateLabel")}</span>
              <NativeSelect name="gouvernorat" defaultValue={governorateId ? String(governorateId) : ""}>
                <option value="">{t("allGovernorates")}</option>
                {governorates.map((governorate) => (
                  <option key={governorate.id} value={governorate.id}>
                    {localizedName(governorate, locale)} ({governorate.count})
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
          <Button type="submit" size="lg" className="h-12">
            {t("filter")}
          </Button>
        </form>
      </header>

      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-foreground pb-2">
        <p className="font-semibold tabular-nums" role="status">
          {t("resultCount", { count: total })}
        </p>
        {filtered && shops.length ? (
          <Link href="/boutiques" className="text-sm font-medium underline underline-offset-4">
            {t("reset")}
          </Link>
        ) : null}
      </div>

      {shops.length ? (
        <ul className="shops-grid">
          {shops.map((shop) => (
            <li key={shop.id}>
              <ShopTile
                name={shop.name}
                slug={shop.slug}
                logoPath={shop.logoPath}
                coverPath={shop.coverPath}
                previews={shop.previews}
                place={[shop.city, shop.governorate]
                  .filter((entry): entry is { name_fr: string; name_ar: string } => Boolean(entry))
                  .map((entry) => localizedName(entry, locale))
                  .filter((name, index, names) => names.indexOf(name) === index)
                  .join(", ")}
                pieces={t("piecesOnline", { count: shop.productCount })}
                description={shop.description}
                emptyLabel={t("windowEmpty")}
              />
            </li>
          ))}
        </ul>
      ) : filtered ? (
        <EmptyState title={t("noMatchTitle")} body={t("noMatchBody")}>
          <Link href="/boutiques" className="font-semibold underline underline-offset-4">
            {t("reset")}
          </Link>
        </EmptyState>
      ) : (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      )}

      <Pagination page={currentPage} total={total} pageSize={CATALOG_PAGE_SIZE} basePath="/boutiques" params={params} />
    </div>
  );
}
