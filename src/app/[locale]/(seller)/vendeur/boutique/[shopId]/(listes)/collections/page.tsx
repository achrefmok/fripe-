import { getTranslations } from "next-intl/server";
import { CreateCollectionForm } from "@/features/collections/components/collection-forms";
import { listShopCollections } from "@/features/collections/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function ShopCollectionsPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/collections">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [collections, t] = await Promise.all([
    listShopCollections(shopId),
    getTranslations("sellerShop"),
  ]);

  return (
    <div className="grid max-w-2xl gap-6">
      {collections.length ? (
        <ul className="divide-y border-y">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link
                href={`/vendeur/boutique/${shopId}/collections/${collection.id}`}
                className="flex items-baseline justify-between gap-3 py-3"
              >
                <span className="font-semibold">{collection.name}</span>
                <span className="text-sm text-muted-foreground">
                  {t("collectionCount", { count: collection.collection_products[0]?.count ?? 0 })}
                  {" · "}
                  {collection.is_published ? t("collectionVisible") : t("collectionHidden")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("collectionsEmpty")}</p>
      )}

      <section>
        <h2 className="font-display text-xl font-bold">{t("collectionCreate")}</h2>
        <div className="mt-4">
          <CreateCollectionForm shopId={shopId} />
        </div>
      </section>
    </div>
  );
}
