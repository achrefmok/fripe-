import { getLocale, getTranslations } from "next-intl/server";
import { ProductForm } from "@/features/catalog/components/product-form";
import { getCategories } from "@/features/catalog/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function NewProductPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/produits/nouveau">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [categories, t, locale] = await Promise.all([
    getCategories("all"),
    getTranslations("sellerShop"),
    getLocale(),
  ]);

  return (
    <div className="max-w-xl">
      <h2 className="font-display text-2xl font-bold">{t("productNew")}</h2>
      <div className="mt-5">
        <ProductForm
          shopId={shopId}
          categories={categories.map((category) => ({
            id: category.id,
            name: locale === "ar" ? category.nameAr : category.nameFr,
          }))}
        />
      </div>
    </div>
  );
}
