import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductForm } from "@/features/catalog/components/product-form";
import { ProductImages } from "@/features/catalog/components/product-images";
import { ProductPublishButton } from "@/features/catalog/components/product-publish-button";
import { getCategories, getProductForEdit } from "@/features/catalog/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { millimesToInput } from "@/lib/utils/price";

export default async function EditProductPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/produits/[productId]">) {
  const { shopId, productId } = await params;
  await requireShopAccess(shopId);

  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    notFound();
  }

  const [product, categories, t, locale] = await Promise.all([
    getProductForEdit(shopId, productId),
    getCategories(),
    getTranslations("sellerShop"),
    getLocale(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="max-w-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">{t("productEdit")}</h2>
        <Link href={`/produit/${product.id}`} className="text-sm font-medium underline underline-offset-4">
          {t("viewShop")}
        </Link>
      </div>

      <section className="mt-5">
        <ProductImages shopId={shopId} productId={product.id} images={product.product_images} />
      </section>

      <div className="mt-6">
        <ProductForm
          shopId={shopId}
          productId={product.id}
          categories={categories.map((category) => ({
            id: category.id,
            name: locale === "ar" ? category.nameAr : category.nameFr,
          }))}
          defaults={{
            title: product.title ?? "",
            categoryId: product.category_id ?? "",
            condition: product.condition ?? "",
            price: millimesToInput(product.price_millimes),
            brand: product.brand ?? "",
            size: product.size ?? "",
            color: product.color ?? "",
            reference: product.reference,
            description: product.description ?? "",
            defects: product.defects ?? "",
          }}
        />
      </div>

      {product.publication_status !== "published" ? (
        <div className="mt-6 border-t pt-5">
          <ProductPublishButton shopId={shopId} productId={product.id} />
        </div>
      ) : null}
    </div>
  );
}
