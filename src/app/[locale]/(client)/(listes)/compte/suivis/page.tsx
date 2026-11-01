import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { ProductGrid } from "@/features/catalog/components/product-card";
import type { ProductCardData } from "@/features/catalog/queries";
import { getFollowedArrivals, listFollowedShops } from "@/features/social/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function FollowingPage() {
  const viewer = await requireViewer("/compte/suivis");
  const [shops, t] = await Promise.all([listFollowedShops(viewer.id), getTranslations("social")]);
  const arrivals = await getFollowedArrivals(shops.map((shop) => shop.id));

  const products: ProductCardData[] = arrivals.map((row) => ({
    id: row.id,
    title: row.title ?? "",
    brand: row.brand,
    size: row.size,
    condition: row.condition,
    priceMillimes: row.price_millimes ?? 0,
    status: row.status,
    shopName: row.shops.name,
    shopSlug: row.shops.slug,
    imagePath: row.product_images[0]?.path ?? null,
  }));

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("followingTitle")}</h1>

      {shops.length ? (
        <>
          <ul className="mt-5 flex flex-wrap gap-2">
            {shops.map((shop) => (
              <li key={shop.id}>
                <Link href={`/boutique/${shop.slug}`} className="block bg-secondary px-3 py-2 text-sm font-semibold">
                  {shop.name}
                </Link>
              </li>
            ))}
          </ul>
          <h2 className="mt-8 mb-4 font-display text-2xl font-extrabold">{t("arrivalsTitle")}</h2>
          {products.length ? (
            <ProductGrid products={products} />
          ) : (
            <p className="text-muted-foreground">{t("arrivalsEmpty")}</p>
          )}
        </>
      ) : (
        <div className="mt-6">
          <EmptyState title={t("followingEmptyTitle")} body={t("followingEmptyBody")}>
            <Button asChild>
              <Link href="/boutiques">{t("browseShops")}</Link>
            </Button>
          </EmptyState>
        </div>
      )}
    </>
  );
}
