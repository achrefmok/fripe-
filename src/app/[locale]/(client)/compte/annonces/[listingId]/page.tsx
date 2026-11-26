import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { OwnerListingActions } from "@/features/marketplace/components/listing-actions";
import { ListingForm } from "@/features/marketplace/components/listing-form";
import { ListingPhotos } from "@/features/marketplace/components/listing-photos";
import { getCategoryAttributes, getListingForEdit, sectionCategories } from "@/features/marketplace/queries";
import { sectionAttributes } from "@/features/catalog/audience";
import { getLocations } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { millimesToInput } from "@/lib/utils/price";

export default async function EditListingPage({ params }: PageProps<"/[locale]/compte/annonces/[listingId]">) {
  const { listingId } = await params;
  const viewer = await requireViewer(`/compte/annonces/${listingId}`);

  if (!/^[0-9a-f-]{36}$/i.test(listingId)) notFound();

  const listing = await getListingForEdit(listingId, viewer.id);
  if (!listing) notFound();

  const section = listing.section;

  const [categories, locations, t] = await Promise.all([
    sectionCategories(section),
    getLocations(),
    getTranslations("market"),
  ]);
  // Au Vide-Dressing, seule la caractéristique « Pour » (femme, homme, enfant) est proposée.
  const attributes = sectionAttributes(section, await getCategoryAttributes(categories.map((category) => category.id)));

  const moderated = Boolean(listing.moderated_at);

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
        <Link href="/compte/annonces" className="underline underline-offset-4">{t("backToListings")}</Link>
        <Link href={`/annonce/${listing.id}`} className="underline underline-offset-4">{t("viewListing")}</Link>
      </div>
      <h1 className="mt-3 font-display text-4xl leading-tight font-extrabold">{t("editTitle")}</h1>
      {moderated ? <p className="mt-3 bg-secondary px-3 py-2 text-sm font-medium" role="status">{t("moderatedNotice")}</p> : null}

      <div className="mt-6 grid gap-8">
        <ListingPhotos listingId={listing.id} images={listing.images} disabled={moderated} />

        {moderated ? null : (
          <ListingForm
            section={section}
            listingId={listing.id}
            categories={categories}
            attributes={attributes}
            governorates={locations}
            initial={{
              categoryId: listing.category_id,
              title: listing.title,
              description: listing.description,
              brand: listing.brand ?? "",
              size: listing.size ?? "",
              condition: listing.condition,
              price: millimesToInput(listing.price_millimes),
              governorateId: String(listing.governorate_id),
              cityId: listing.city_id ? String(listing.city_id) : "",
              attributes: listing.attributes as Record<string, string>,
              defects: listing.defects ?? "",
              noDefects: listing.defects === "",
            }}
          />
        )}

        <div className="border-t-2 border-foreground/80 pt-5">
          <OwnerListingActions
            listingId={listing.id}
            status={listing.status}
            hidden={listing.publication_status !== "published"}
            moderated={moderated}
          />
        </div>
      </div>
    </>
  );
}
