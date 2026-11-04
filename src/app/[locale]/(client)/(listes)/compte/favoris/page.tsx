import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { getFavorites } from "@/features/catalog/queries";
import { MarketGrid } from "@/features/marketplace/components/market-card";
import { getListingFavorites } from "@/features/marketplace/queries";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function FavoritesPage() {
  const viewer = await requireViewer("/compte/favoris");
  const [favorites, listings, t, market] = await Promise.all([
    getFavorites(viewer.id),
    getListingFavorites(viewer.id),
    getTranslations("favorites"),
    getTranslations("market"),
  ]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <div className="mt-6 grid gap-10">
        {favorites.length || !listings.length ? (
          favorites.length ? (
            <ProductGrid products={favorites} />
          ) : (
            <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
          )
        ) : null}
        {listings.length ? (
          <section>
            <h2 className="mb-4 font-display text-2xl font-extrabold">{market("particulierBadge")}</h2>
            <MarketGrid items={listings} />
          </section>
        ) : null}
      </div>
    </>
  );
}
