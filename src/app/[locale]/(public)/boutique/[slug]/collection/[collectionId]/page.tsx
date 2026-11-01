import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { getPublicCollection } from "@/features/catalog/queries";
import { Link } from "@/i18n/navigation";

export default async function PublicCollectionPage({
  params,
}: PageProps<"/[locale]/boutique/[slug]/collection/[collectionId]">) {
  const { slug, collectionId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(collectionId)) {
    notFound();
  }

  const collection = await getPublicCollection(collectionId);

  if (!collection || collection.shops.slug !== slug) {
    notFound();
  }

  const t = await getTranslations("shopPublic");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-10">
      <Link href={`/boutique/${slug}`} className="text-sm font-medium underline underline-offset-4">
        {t("backToShop", { shop: collection.shops.name })}
      </Link>
      <h1 className="mt-3 font-display text-4xl font-extrabold">{collection.name}</h1>
      {collection.description ? (
        <p className="mt-2 max-w-2xl text-muted-foreground">{collection.description}</p>
      ) : null}

      <div className="mt-6">
        {collection.products.length ? (
          <ProductGrid products={collection.products} />
        ) : (
          <p className="text-muted-foreground">{t("emptyCollection")}</p>
        )}
      </div>
    </div>
  );
}
