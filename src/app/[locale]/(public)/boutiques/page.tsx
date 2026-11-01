import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/features/admin/components/pagination";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/constants";
import { listPublicShops } from "@/features/catalog/queries";
import { Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";

export async function generateMetadata() {
  const t = await getTranslations("shopPublic");
  return { title: t("title") };
}

export default async function ShopsPage({ searchParams }: PageProps<"/[locale]/boutiques">) {
  const { page } = await searchParams;
  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ shops, total }, t, locale] = await Promise.all([
    listPublicShops(currentPage),
    getTranslations("shopPublic"),
    getLocale(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-10">
      <h1 className="mb-6 font-display text-4xl font-extrabold">{t("title")}</h1>

      {shops.length ? (
        <ul className="divide-y border-y">
          {shops.map((shop) => (
            <li key={shop.id}>
              <Link href={`/boutique/${shop.slug}`} className="block py-4">
                <span className="block font-display text-xl font-bold">{shop.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {shop.cities && localizedName(shop.cities, locale)}
                </span>
                {shop.description ? (
                  <span className="mt-1 line-clamp-2 block text-sm">{shop.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      )}

      <Pagination
        page={currentPage}
        total={total}
        pageSize={CATALOG_PAGE_SIZE}
        basePath="/boutiques"
        params={{}}
      />
    </div>
  );
}
