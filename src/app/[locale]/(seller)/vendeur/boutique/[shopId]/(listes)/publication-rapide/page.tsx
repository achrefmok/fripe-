import { getTranslations } from "next-intl/server";
import { CsvImporter } from "@/features/catalog/components/csv-importer";
import { PhotoBatch } from "@/features/catalog/components/photo-batch";
import { getCategories } from "@/features/catalog/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function QuickPublishPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/publication-rapide">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [categories, t] = await Promise.all([getCategories(), getTranslations("sellerShop")]);

  return (
    <div className="grid max-w-2xl gap-8">
      <div>
        <h2 className="font-display text-2xl font-bold">{t("quickTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("quickLead")}</p>
      </div>

      <section className="border-t pt-5">
        <h3 className="font-display text-xl font-bold">{t("quickPhotosTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("quickPhotosBody")}</p>
        <div className="mt-3">
          <PhotoBatch shopId={shopId} />
        </div>
      </section>

      <section className="border-t pt-5">
        <h3 className="font-display text-xl font-bold">{t("quickCsvTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("quickCsvBody")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("quickPhotoNote")}</p>
        <div className="mt-3">
          <CsvImporter shopId={shopId} categories={categories} />
        </div>
      </section>

      <p className="border-t pt-5">
        <Link
          href={{ pathname: `/vendeur/boutique/${shopId}/produits`, query: { onglet: "draft" } }}
          className="font-semibold underline underline-offset-4"
        >
          {t("quickGoDrafts")}
        </Link>
      </p>
    </div>
  );
}
