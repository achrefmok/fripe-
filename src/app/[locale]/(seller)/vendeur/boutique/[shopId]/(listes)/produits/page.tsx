import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/features/admin/components/pagination";
import { ProductsManager } from "@/features/catalog/components/products-manager";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/constants";
import { getCategories, listShopProducts } from "@/features/catalog/queries";
import { getShop } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";

const TABS = [
  ["draft", "tabDrafts"],
  ["published", "tabPublished"],
  ["archived", "tabArchived"],
] as const;

export default async function ShopProductsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/produits">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const { onglet, q, page } = await searchParams;
  const tab = TABS.find(([value]) => value === onglet)?.[0] ?? "draft";
  const search = typeof q === "string" ? q.slice(0, 80) : "";
  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ products, total }, categories, shop, t, locale] = await Promise.all([
    listShopProducts(shopId, tab, search, currentPage),
    getCategories("all"),
    getShop(shopId),
    getTranslations("sellerShop"),
    getLocale(),
  ]);

  const base = `/vendeur/boutique/${shopId}/produits`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t("products")} className="flex gap-1">
          {TABS.map(([value, label]) => (
            <Link
              key={value}
              href={{ pathname: base, query: { onglet: value } }}
              aria-current={value === tab ? "true" : undefined}
              className={cn(
                "flex h-9 items-center px-3 text-sm font-medium",
                value === tab ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {t(label)}
            </Link>
          ))}
        </nav>
        <Button asChild size="sm">
          <Link href={`${base}/nouveau`}>{t("newProduct")}</Link>
        </Button>
      </div>

      {shop?.status === "pending" ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("pendingShopNotice")}</p>
      ) : null}

      <form className="mt-3 max-w-sm" role="search">
        <input type="hidden" name="onglet" value={tab} />
        <Input
          name="q"
          type="search"
          defaultValue={search}
          aria-label={t("searchProducts")}
          placeholder={t("searchProducts")}
        />
      </form>

      <div className="mt-4">
        <ProductsManager
          key={`${tab}-${currentPage}-${search}`}
          shopId={shopId}
          tab={tab}
          products={products}
          categories={categories.map((category) => ({
            id: category.id,
            name: locale === "ar" ? category.nameAr : category.nameFr,
          }))}
        />
      </div>

      <Pagination
        page={currentPage}
        total={total}
        pageSize={CATALOG_PAGE_SIZE}
        basePath={base}
        params={{ onglet: tab, ...(search ? { q: search } : {}) }}
      />
    </>
  );
}
