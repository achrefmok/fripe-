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
import { shopAssetUrl } from "@/lib/utils/storage";
import { ShopLocation } from "@/features/shops/components/shop-location";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { getShopLocation } from "@/features/shops/queries";
import Image from "next/image";

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
  const { page, onglet } = await searchParams;
  const tab = onglet === "magasin" ? "stock" : "pieces";
  const shop = await getPublicShop(slug);

  if (!shop) {
    notFound();
  }

  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ products, total }, stock, collections, t, requests, locale, viewer, reviews, reviewLabels, messaging, place, where] = await Promise.all([
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
    getShopLocation(shop.id),
    getTranslations("shopLocation"),
  ]);

  const [following, blockSides] = viewer
    ? await Promise.all([isFollowing(viewer.id, shop.id), getBlockSides(viewer.id, shop.id)])
    : [false, []];

  const average = shop.rating_count ? Math.round((shop.rating_sum / shop.rating_count) * 10) / 10 : 0;

  return (
    <div className="mx-auto max-w-[1200px] px-[18px] pb-24 pt-[18px] md:pb-12">
      {/* Friptex Luxe : la couverture de la boutique, son médaillon cerclé d'or et le bouton suivre. */}
      <section className="lx-shophero">
        {shop.cover_path ? (
          <Image src={shopAssetUrl(shop.cover_path)} alt="" fill priority sizes="100vw" className="lx-shophero__cover" />
        ) : null}
        <span className="lx-shophero__veil" aria-hidden="true" />
        <div className="lx-shophero__body">
          <ShopMark name={shop.name} logoPath={shop.logo_path} size="lg" className="lx-shophero__mark" />
          <div className="min-w-0 flex-[1_1_200px]">
            <h1 className="font-display text-[clamp(30px,4.4vw,48px)] leading-none" dir="auto">{shop.name}</h1>
            <p className="mt-1 text-sm opacity-90">
              {shop.cities && localizedName(shop.cities, locale)}
              {shop.governorates && `, ${localizedName(shop.governorates, locale)}`}
              {" · "}
              {t("piecesCount", { count: total })}
              {" · "}
              {t("verified")}
              {place ? (
                <>
                  {" · "}
                  <a href="#adresse" className="underline underline-offset-4">
                    {where("heroLink")}
                  </a>
                </>
              ) : null}
            </p>
            {shop.rating_count ? (
              <a href="#avis" className="mt-1.5 inline-flex items-center gap-2 text-sm font-medium">
                <RatingStars rating={Math.round(average)} />
                {reviewLabels("summary", { average, count: shop.rating_count })}
              </a>
            ) : null}
          </div>
          <FollowButton
            shopId={shop.id}
            slug={shop.slug}
            signedIn={Boolean(viewer)}
            initialFollowing={following}
            initialCount={shop.follower_count}
          />
        </div>
      </section>

      {shop.description ? <p className="mt-4 max-w-2xl leading-relaxed" dir="auto">{shop.description}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {blockSides.length ? (
          <p className="w-full text-sm text-muted-foreground">{messaging("blockedNotice")}</p>
        ) : (
          <>
            <Button asChild variant="outline">
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

      <nav aria-label={t("tabsLabel")} className="lx-segment mt-[18px] w-max max-w-full">
        <Link href={`/boutique/${shop.slug}`} aria-current={tab === "pieces" ? "page" : undefined} className="lx-segment__item">
          {t("pieces")}
        </Link>
        <Link href={{ pathname: `/boutique/${shop.slug}`, query: { onglet: "magasin" } }} aria-current={tab === "stock" ? "page" : undefined} className="lx-segment__item">
          {t("stockTitle")}
        </Link>
      </nav>

      {collections.length ? (
        <section className="mt-10">
          <h2 className="font-display text-2xl">{t("collections")}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/boutique/${shop.slug}/collection/${collection.id}`}
                  className="block rounded-full bg-secondary px-4 py-2 font-medium hover:bg-foreground hover:text-background"
                >
                  {collection.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "stock" ? (
        <section className="mt-5" aria-label={t("stockTitle")}>
          <p className="mb-3.5 max-w-xl leading-relaxed text-muted-foreground">{t("stockLead")}</p>
          {stock.length ? (
            <ul className="border-t">
              {stock.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3.5 border-b py-4">
                  <span className="flex-[1_1_200px] font-display text-xl">
                    {item.categories && localizedName(item.categories, locale)}
                    {item.label ? ` · ${item.label}` : ""}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{t("stockLine", { count: item.approx_quantity })}</span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/boutique/${shop.slug}/demande`}>{t("askItem")}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t("stockEmpty")}</p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">{t("stockNote")}</p>
        </section>
      ) : (
      <section className="mt-5" aria-label={t("pieces")}>
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
      )}

      {place ? (
        <ShopLocation
          shopName={shop.name}
          address={place.addressLine}
          place={[place.city && localizedName(place.city, locale), place.governorate && localizedName(place.governorate, locale)].filter(Boolean).join(", ")}
          coordinates={place.coordinates}
        />
      ) : null}

      <section id="avis" className="mt-10 scroll-mt-20">
        <h2 className="font-display text-2xl">{reviewLabels("title")}</h2>
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
