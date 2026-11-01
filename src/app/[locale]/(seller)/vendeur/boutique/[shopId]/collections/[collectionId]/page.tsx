import { notFound } from "next/navigation";
import { EditCollectionForm } from "@/features/collections/components/collection-forms";
import { getShopCollection, listCollectionCandidates } from "@/features/collections/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function EditCollectionPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/collections/[collectionId]">) {
  const { shopId, collectionId } = await params;
  await requireShopAccess(shopId);

  if (!/^[0-9a-f-]{36}$/i.test(collectionId)) {
    notFound();
  }

  const [collection, candidates] = await Promise.all([
    getShopCollection(shopId, collectionId),
    listCollectionCandidates(shopId),
  ]);

  if (!collection) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <EditCollectionForm
        shopId={shopId}
        collectionId={collection.id}
        defaults={{
          name: collection.name,
          description: collection.description ?? "",
          isPublished: collection.is_published,
        }}
        selectedIds={collection.collection_products.map((item) => item.product_id)}
        candidates={candidates}
      />
    </div>
  );
}
