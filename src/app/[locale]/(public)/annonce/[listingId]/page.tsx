import { ShieldCheck, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/features/catalog/components/product-gallery";
import { DressingRail } from "@/features/dressing/components/dressing-card";
import { DressingFavorites } from "@/features/dressing/components/favorites";
import { getAroundListing } from "@/features/dressing/queries";
import { dressingFirstName, dressingMonogram, dressingTone } from "@/features/dressing/tone";
import { getCategoryAttributes, getLatestListings, getListing, getViewerListingState } from "@/features/marketplace/queries";
import { ContactSellerForm, FavoriteListingButton, OwnerListingActions } from "@/features/marketplace/components/listing-actions";
import { MarketRail } from "@/features/marketplace/components/market-card";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";
import { formatDate, localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: PageProps<"/[locale]/annonce/[listingId]">) {
  const { listingId } = await params;
  const listing = UUID.test(listingId) ? await getListing(listingId) : null;
  return { title: listing?.title ?? undefined };
}

export default async function ListingPage({ params }: PageProps<"/[locale]/annonce/[listingId]">) {
  const { listingId } = await params;
  if (!UUID.test(listingId)) notFound();

  const listing = await getListing(listingId);
  if (!listing) notFound();

  const inDressing = listing.section === "vide_dressing";
  const [viewer, t, dressing, conditions, locale, attributes, similar, around] = await Promise.all([
    getViewer(),
    getTranslations("market"),
    getTranslations("dressing"),
    getTranslations("conditions"),
    getLocale(),
    getCategoryAttributes([listing.category_id, listing.categories?.parent_id].filter((id): id is string => Boolean(id))),
    inDressing ? [] : getLatestListings(listing.section, 9),
    // Autour d'une pièce du Vide-Dressing : le reste du même dressing et des pièces proches.
    inDressing
      ? getAroundListing({ id: listing.id, sellerId: listing.seller_id, categoryId: listing.category_id, brand: listing.brand })
      : null,
  ]);
  const tone = dressingTone(listing.seller_id);

  const own = viewer?.id === listing.seller_id;
  const state = viewer && !own ? await getViewerListingState(listing.id, viewer.id) : null;
  const sectionHref = listing.section === "marketplace" ? "/marketplace" : "/vide-dressing";
  const sectionName = listing.section === "marketplace" ? t("marketplaceTitle") : t("videDressingTitle");
  const values = listing.attributes as Record<string, string>;

  const details = [
    { label: t("condition"), value: conditions(listing.condition) },
    { label: t("brand"), value: listing.brand },
    { label: t("size"), value: listing.size },
    ...attributes
      .filter((attribute) => values[attribute.key])
      .map((attribute) => ({
        label: locale === "ar" ? attribute.labelAr : attribute.labelFr,
        value:
          attribute.kind === "choice"
            ? (() => {
                const option = attribute.options.find((entry) => entry.value === values[attribute.key]);
                return option ? (locale === "ar" ? option.ar : option.fr) : values[attribute.key];
              })()
            : values[attribute.key],
      })),
  ].filter((detail) => detail.value);

  const place = [listing.cities && localizedName(listing.cities, locale), listing.governorates && localizedName(listing.governorates, locale)]
    .filter(Boolean)
    .join(", ");

  const notice = listing.moderated_at
    ? t("moderatedNotice")
    : listing.publication_status !== "published"
      ? t("hiddenNotice")
      : listing.status === "sold"
        ? t("soldNotice")
        : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-6 md:pb-16 md:pt-10">
      <nav className="mb-4 flex flex-wrap items-center gap-x-2 text-sm font-semibold">
        <Link href={sectionHref} className="underline underline-offset-4">{sectionName}</Link>
        {listing.categories ? (
          <>
            <span aria-hidden="true">/</span>
            <Link href={{ pathname: sectionHref, query: { categorie: listing.categories.slug } }} className="underline underline-offset-4">
              {localizedName(listing.categories, locale)}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2 md:gap-10">
        <ProductGallery images={listing.images} title={listing.title} bucket="listing" />

        <div className="min-w-0">
          {notice ? <p className="mb-3 bg-secondary px-3 py-2 text-sm font-medium" role="status">{notice}</p> : null}

          <h1 className="font-display text-3xl leading-tight font-extrabold break-words md:text-4xl">{listing.title}</h1>
          <p className="mt-2 font-display text-3xl font-extrabold text-harissa">{formatPrice(listing.price_millimes, locale)}</p>
          {listing.status === "reserved" ? <p className="mt-1 text-sm font-semibold">{t("reserved")}</p> : null}

          <div className="seller-card mt-5">
            {inDressing ? (
              <span className="vd-avatar" style={{ background: tone.surface, color: tone.ink }} aria-hidden="true">
                {dressingMonogram(listing.seller_name)}
              </span>
            ) : (
              <span className="seller-person seller-person--lg" aria-hidden="true">
                <UserRound className="size-5" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-sm text-muted-foreground">{t("sellerTitle")}</span>
              <span className="block truncate font-display text-lg font-extrabold">
                {listing.seller_name}
                <span className="ms-2 align-middle status-tag bg-kraft text-[oklch(0.2_0.014_55)]">{t("particulierBadge")}</span>
              </span>
              <span className="block text-sm text-muted-foreground">
                {place}
                {listing.published_at ? ` · ${t("publishedOn", { date: formatDate(listing.published_at, locale) })}` : ""}
              </span>
              {inDressing ? (
                <Link href={`/vide-dressing/dressing/${listing.seller_id}`} className="mt-1 inline-flex min-h-9 items-center text-sm font-medium text-goldink underline underline-offset-4">
                  {dressing("visitDressing")}
                </Link>
              ) : null}
            </span>
          </div>

          <div id="contact" className="mt-5 grid scroll-mt-28 gap-3">
            {own ? (
              <div className="grid gap-3 rounded-[18px] border bg-surface p-4">
                <p className="font-display text-lg font-extrabold">{t("ownListing")}</p>
                <Link href={`/compte/annonces/${listing.id}`} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                  {t("edit")}
                </Link>
                <OwnerListingActions
                  listingId={listing.id}
                  status={listing.status}
                  hidden={listing.publication_status !== "published"}
                  moderated={Boolean(listing.moderated_at)}
                />
              </div>
            ) : notice ? null : viewer ? (
              state?.threadId ? (
                <Link href={`/compte/echanges/${state.threadId}`} className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-primary-foreground">
                  {t("openThread")}
                </Link>
              ) : (
                <ContactSellerForm listingId={listing.id} />
              )
            ) : (
              <Link
                href={`/connexion?next=${encodeURIComponent(`/annonce/${listing.id}`)}`}
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-semibold text-primary-foreground"
              >
                {t("contactSignIn")}
              </Link>
            )}

            {viewer && !own && !notice ? (
              <div className="flex flex-wrap items-center gap-2">
                <FavoriteListingButton listingId={listing.id} initial={Boolean(state?.isFavorite)} />
                <ReportDialog targetType="listing" targetId={listing.id} label={t("reportListing")} />
              </div>
            ) : null}
          </div>

          {details.length ? (
            <section className="mt-6">
              <h2 className="font-semibold">{t("details")}</h2>
              <dl className="mt-2 divide-y border-y">
                {details.map((detail) => (
                  <div key={detail.label} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted-foreground">{detail.label}</dt>
                    <dd className="text-end font-medium">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {listing.description ? (
            <section className="mt-6">
              <h2 className="font-semibold">{t("description")}</h2>
              <p className="mt-1 leading-relaxed break-words whitespace-pre-line text-muted-foreground">{listing.description}</p>
            </section>
          ) : null}

          <aside className="mt-6 flex gap-3 rounded-[18px] bg-cream p-4 text-sm leading-relaxed">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="block">{t("safetyTitle")}</strong>
              {t("particulierHint")} {t("safetyBody")}
            </span>
          </aside>
        </div>
      </div>

      {around ? (
        <DressingFavorites next={`/annonce/${listing.id}`}>
          {around.sameDressing.length ? (
            <section className="vd-section" aria-labelledby="vd-same">
              <div className="vd-section__head">
                <h2 id="vd-same" className="vd-section__title">{dressing("sameDressing")}</h2>
                <Link href={`/vide-dressing/dressing/${listing.seller_id}`} className="vd-section__lead underline underline-offset-4">
                  {dressing("dressingOf", { name: dressingFirstName(listing.seller_name) })}
                </Link>
              </div>
              <DressingRail items={around.sameDressing} label={dressing("sameDressing")} />
            </section>
          ) : null}
          {around.similar.length ? (
            <section className="vd-section" aria-labelledby="vd-similar">
              <div className="vd-section__head">
                <h2 id="vd-similar" className="vd-section__title">{dressing("similar")}</h2>
              </div>
              <DressingRail items={around.similar} label={dressing("similar")} />
            </section>
          ) : null}
        </DressingFavorites>
      ) : null}

      {similar.filter((item) => item.id !== listing.id).length ? (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-extrabold">{t("latestTitle")}</h2>
          <MarketRail items={similar.filter((item) => item.id !== listing.id).slice(0, 8)} />
        </section>
      ) : null}
    </div>
  );
}
