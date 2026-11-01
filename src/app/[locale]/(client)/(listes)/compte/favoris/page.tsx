import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { getFavorites } from "@/features/catalog/queries";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function FavoritesPage() {
  const viewer = await requireViewer("/compte/favoris");
  const [favorites, t] = await Promise.all([getFavorites(viewer.id), getTranslations("favorites")]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <div className="mt-6">
        {favorites.length ? (
          <ProductGrid products={favorites} />
        ) : (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
      </div>
    </>
  );
}
