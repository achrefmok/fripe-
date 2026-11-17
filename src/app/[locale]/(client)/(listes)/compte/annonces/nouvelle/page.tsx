import { getTranslations } from "next-intl/server";
import { ListingForm } from "@/features/marketplace/components/listing-form";
import { getCategoryAttributes, sectionCategories } from "@/features/marketplace/queries";
import { getLocations } from "@/features/shops/queries";
import { requireViewer } from "@/lib/permissions/viewer";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("publish") };
}

export default async function NewListingPage({ searchParams }: PageProps<"/[locale]/compte/annonces/nouvelle">) {
  const { rubrique } = await searchParams;
  const section = rubrique === "vide_dressing" ? "vide_dressing" : "marketplace";
  await requireViewer(`/compte/annonces/nouvelle?rubrique=${section}`);

  const [categories, locations, t] = await Promise.all([
    sectionCategories(section),
    getLocations(),
    getTranslations("market"),
  ]);
  const attributes = section === "marketplace" ? await getCategoryAttributes(categories.map((category) => category.id)) : [];

  return (
    <>
      <h1 className="font-display text-4xl leading-tight font-extrabold">
        {section === "marketplace" ? t("newTitleMarketplace") : t("newTitleDressing")}
      </h1>
      <p className="mt-2 mb-6 text-muted-foreground">{t("particulierHint")}</p>
      <ListingForm
        section={section}
        categories={categories}
        attributes={attributes}
        governorates={locations}
        initial={{ categoryId: "", title: "", description: "", brand: "", size: "", condition: "", price: "", governorateId: "", cityId: "", attributes: {}, defects: "", noDefects: false }}
      />
    </>
  );
}
