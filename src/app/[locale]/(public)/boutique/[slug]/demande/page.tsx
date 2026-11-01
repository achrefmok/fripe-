import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getCategories, getPublicShop } from "@/features/catalog/queries";
import { StockRequestForm } from "@/features/inventory/components/stock-request-form";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function StockRequestPage({
  params,
}: PageProps<"/[locale]/boutique/[slug]/demande">) {
  const { slug } = await params;
  const shop = await getPublicShop(slug);

  if (!shop) {
    notFound();
  }

  await requireViewer(`/boutique/${slug}/demande`);

  const [categories, t, locale] = await Promise.all([
    getCategories(),
    getTranslations("requests"),
    getLocale(),
  ]);

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-6 md:pt-10">
      <h1 className="font-display text-3xl leading-tight font-extrabold">
        {t("askTitle", { shop: shop.name })}
      </h1>
      <p className="mt-2 text-muted-foreground">{t("askLead")}</p>
      <div className="mt-6">
        <StockRequestForm
          shopId={shop.id}
          categories={categories.map((category) => ({
            id: category.id,
            name: locale === "ar" ? category.nameAr : category.nameFr,
          }))}
        />
      </div>
    </div>
  );
}
