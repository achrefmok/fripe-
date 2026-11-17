import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { EmptyState } from "@/components/layout/empty-state";
import { OwnerListingActions } from "@/features/marketplace/components/listing-actions";
import { getMyListings } from "@/features/marketplace/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { formatPrice } from "@/lib/utils/price";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("myTitle") };
}

export default async function MyListingsPage() {
  const viewer = await requireViewer("/compte/annonces");
  const [listings, t, locale] = await Promise.all([getMyListings(viewer.id), getTranslations("market"), getLocale()]);

  const stateOf = (listing: (typeof listings)[number]) =>
    listing.moderated_at
      ? t("stateModerated")
      : listing.publication_status !== "published"
        ? t("stateHidden")
        : listing.status === "sold"
          ? t("stateSold")
          : listing.status === "reserved"
            ? t("stateReserved")
            : t("stateOnline");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">{t("myTitle")}</h1>
        <Link href="/vendre" className="inline-flex h-11 items-center gap-2 bg-primary px-4 font-semibold text-primary-foreground">
          <Plus className="size-4" aria-hidden="true" />
          {t("publish")}
        </Link>
      </div>

      {listings.length ? (
        <ul className="mt-6 divide-y border-y">
          {listings.map((listing) => (
            <li key={listing.id} className="flex gap-3 py-4">
              <Link href={`/compte/annonces/${listing.id}`} className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden bg-secondary">
                {listing.imageUrl ? <Image src={listing.imageUrl} alt="" fill sizes="80px" className="object-cover" /> : null}
              </Link>
              <div className="grid min-w-0 flex-1 content-start gap-1.5">
                <Link href={`/compte/annonces/${listing.id}`} className="truncate font-semibold hover:underline">
                  {listing.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(listing.price_millimes, locale)} · {listing.section === "marketplace" ? t("sectionMarketplace") : t("sectionDressing")} ·{" "}
                  <span className="font-semibold text-foreground">{stateOf(listing)}</span> · {t("favoritesCount", { count: listing.favorite_count })}
                </p>
                <OwnerListingActions
                  listingId={listing.id}
                  status={listing.status}
                  hidden={listing.publication_status !== "published"}
                  moderated={Boolean(listing.moderated_at)}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <EmptyState title={t("myEmptyTitle")} body={t("myEmptyBody")}>
            <Link href="/vendre" className="font-semibold underline underline-offset-4">
              {t("publish")}
            </Link>
          </EmptyState>
        </div>
      )}
    </>
  );
}
