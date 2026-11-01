import { getLocale, getTranslations } from "next-intl/server";
import { Input } from "@/components/ui/input";
import { ModerateProductButton } from "@/features/admin/components/market-actions";
import { Pagination } from "@/features/admin/components/pagination";
import { listAllProducts, ORDER_PAGE_SIZE } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/[locale]/admin/produits">) {
  await requireAdmin("/admin/produits");
  const { q, page, vue } = await searchParams;
  const moderatedOnly = vue === "moderes";

  const search = typeof q === "string" ? q.slice(0, 80) : "";
  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ products, total }, t, locale] = await Promise.all([
    listAllProducts(search, currentPage, moderatedOnly),
    getTranslations("adminMarket"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("productsTitle")}</h1>

      <form className="mt-4 max-w-md" role="search">
        <Input
          name="q"
          type="search"
          defaultValue={search}
          aria-label={t("searchProducts")}
          placeholder={t("searchProducts")}
        />
      </form>

      <nav aria-label={t("productsTitle")} className="mt-3 flex gap-1">
        {[
          { href: "/admin/produits", label: t("viewPublished"), active: !moderatedOnly },
          { href: "/admin/produits?vue=moderes", label: t("viewModerated"), active: moderatedOnly },
        ].map((view) => (
          <Link
            key={view.href}
            href={view.href}
            aria-current={view.active ? "true" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center px-3 text-sm font-medium",
              view.active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {view.label}
          </Link>
        ))}
      </nav>

      {products.length ? (
        <ul className="mt-4 divide-y border-y">
          {products.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/produit/${product.id}`} className="block truncate font-semibold">
                  {product.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {product.shops?.name} ·{" "}
                  {product.price_millimes ? formatPrice(product.price_millimes, locale) : ""}
                </p>
              </div>
              {product.moderated_at ? null : <ModerateProductButton productId={product.id} title={product.title ?? ""} />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("productsEmpty")}</p>
      )}

      <Pagination
        page={currentPage}
        total={total}
        pageSize={ORDER_PAGE_SIZE}
        basePath="/admin/produits"
        params={{ ...(search ? { q: search } : {}), ...(moderatedOnly ? { vue: "moderes" } : {}) }}
      />
    </>
  );
}
