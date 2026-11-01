import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BlockShopButton } from "@/features/messaging/components/block-buttons";
import { ContactButton } from "@/features/messaging/components/contact-button";
import { getBlockSides } from "@/features/messaging/queries";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { RatingStars } from "@/features/reviews/components/rating-stars";
import { ReviewItem } from "@/features/reviews/components/review-item";
import { listPublicReviews } from "@/features/reviews/queries";
import { FollowButton } from "@/features/social/components/social-controls";
import { isFollowing } from "@/features/social/queries";
import { Pagination } from "@/features/admin/components/pagination";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { CATALOG_PAGE_SIZE } from "@/features/catalog/constants";
import { getPublicShop, getShopCatalog } from "@/features/catalog/queries";
import { listPublicShopCollections } from "@/features/collections/queries";
import { listPublicInventory } from "@/features/inventory/queries";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";
import { localizedName } from "@/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/[locale]/boutique/[slug]">) {
  const { slug } = await params;
  const shop = await getPublicShop(slug);
  return { title: shop?.name };
}

export default async function PublicShopPage({
  params,
  searchParams,
}: PageProps<"/[locale]/boutique/[slug]">) {
  const { slug } = await params;
  const { page } = await searchParams;
  const shop = await getPublicShop(slug);

  if (!shop) {
    notFound();
  }

  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ products, total }, stock, collections, t, requests, locale, viewer, reviews, reviewLabels, messaging] = await Promise.all([
    getShopCatalog(shop.id, currentPage),
    listPublicInventory(shop.id),
    listPublicShopCollections(shop.id),
    getTranslations("shopPublic"),
    getTranslations("requests"),
    getLocale(),
    getViewer(),
    listPublicReviews(shop.id),
    getTranslations("reviews"),
    getTranslations("messaging"),
  ]);

  const [following, blockSides] = viewer
    ? await Promise.all([isFollowing(viewer.id, shop.id), getBlockSides(viewer.id, shop.id)])
    : [false, []];

  const average = shop.rating_count ? Math.round((shop.rating_sum / shop.rating_count) * 10) / 10 : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-10">
      <h1 className="font-display text-4xl leading-tight font-extrabold md:text-5xl">{shop.name}</h1>
      <p className="mt-1 text-muted-foreground">
        {shop.cities && localizedName(shop.cities, locale)}
        {shop.governorates && `, ${localizedName(shop.governorates, locale)}`}
      </p>
      {shop.rating_count ? (
        <a href="#avis" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
          <RatingStars rating={Math.round(average)} />
          {reviewLabels("summary", { average, count: shop.rating_count })}
        </a>
      ) : null}
      {shop.description ? <p className="mt-3 max-w-2xl leading-relaxed">{shop.description}</p> : null}

      <div className="mt-4">
        <FollowButton
          shopId={shop.id}
          slug={shop.slug}
          signedIn={Boolean(viewer)}
          initialFollowing={following}
          initialCount={shop.follower_count}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {blockSides.length ? (
          <p className="w-full text-sm text-muted-foreground">{messaging("blockedNotice")}</p>
        ) : (
          <>
            <Button asChild>
              <Link href={`/boutique/${shop.slug}/demande`}>{requests("ask")}</Link>
            </Button>
            <ContactButton signedIn={Boolean(viewer)} next={`/boutique/${shop.slug}`} shopId={shop.id} />
          </>
        )}
        {viewer ? (
          <>
            <BlockShopButton shopId={shop.id} blocked={blockSides.includes("client")} />
            <ReportDialog targetType="shop" targetId={shop.id} />
          </>
        ) : null}
      </div>

      {stock.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-extrabold">{t("stockTitle")}</h2>
          <ul className="mt-3 divide-y border-y">
            {stock.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="font-semibold">
                  {item.categories && localizedName(item.categories, locale)}
                  {item.label ? ` · ${item.label}` : ""}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {t("stockLine", { count: item.approx_quantity })}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">{t("stockNote")}</p>
        </section>
      ) : null}

      {collections.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-extrabold">{t("collections")}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/boutique/${shop.slug}/collection/${collection.id}`}
                  className="block bg-secondary px-4 py-2 font-semibold hover:bg-foreground hover:text-background"
                >
                  {collection.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl font-extrabold">{t("pieces")}</h2>
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <p className="text-muted-foreground">{t("noPieces")}</p>
        )}
        <Pagination
          page={currentPage}
          total={total}
          pageSize={CATALOG_PAGE_SIZE}
          basePath={`/boutique/${shop.slug}`}
          params={{}}
        />
      </section>

      <section id="avis" className="mt-10 scroll-mt-20">
        <h2 className="font-display text-2xl font-extrabold">{reviewLabels("title")}</h2>
        {reviews.length ? (
          <ul className="mt-3 max-w-2xl divide-y border-y">
            {reviews.map((review) => (
              <ReviewItem key={review.id} review={review}>
                {viewer ? (
                  <div className="-ms-3">
                    <ReportDialog targetType="review" targetId={review.id} />
                  </div>
                ) : null}
              </ReviewItem>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground">{reviewLabels("empty")}</p>
        )}
      </section>
    </div>
  );
}
