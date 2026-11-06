import { getTranslations } from "next-intl/server";
import { ProductForm } from "@/features/catalog/components/product-form";
import { getCategories, getShopBrands } from "@/features/catalog/queries";
import { getCategoryAttributes } from "@/features/marketplace/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function NewProductPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/produits/nouveau">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [categories, brands, t, p] = await Promise.all([
    getCategories("all"),
    getShopBrands(shopId),
    getTranslations("sellerShop"),
    getTranslations("productForm"),
  ]);
  const attributes = await getCategoryAttributes(categories.map((category) => category.id));

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl font-bold">{t("productNew")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{p("lead")}</p>
      <div className="mt-5">
        <ProductForm shopId={shopId} categories={categories} attributes={attributes} shopBrands={brands} />
      </div>
    </div>
  );
}
