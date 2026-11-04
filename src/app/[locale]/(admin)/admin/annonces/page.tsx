import { getLocale, getTranslations } from "next-intl/server";
import { ModerateListingButton } from "@/features/marketplace/components/moderate-listing-button";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

export default async function AdminListingsPage() {
  const [t, locale] = await Promise.all([getTranslations("market"), getLocale()]);

  // Session administrateur : la politique de lecture laisse voir toutes les annonces.
  const supabase = await createClient();
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, title, seller_name, section, price_millimes, status, publication_status, moderated_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("adminTitle")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("adminLead")}</p>

      {listings.length ? (
        <ul className="mt-6 divide-y border-y">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/annonce/${listing.id}`} className="block truncate font-semibold hover:underline">
                  {listing.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {listing.seller_name} · {listing.section === "marketplace" ? t("sectionMarketplace") : t("sectionDressing")} ·{" "}
                  {formatPrice(listing.price_millimes, locale)} · {formatDateTime(listing.created_at, locale)}
                </p>
              </div>
              {listing.moderated_at ? (
                <span className="status-tag bg-secondary">{t("stateModerated")}</span>
              ) : (
                <ModerateListingButton listingId={listing.id} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("adminEmpty")}</p>
      )}
    </>
  );
}
