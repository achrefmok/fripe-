import { getTranslations } from "next-intl/server";
import { ReplyButton } from "@/features/reviews/components/review-actions";
import { ReviewItem } from "@/features/reviews/components/review-item";
import { listShopReviews } from "@/features/reviews/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function ShopReviewsPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/avis">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [reviews, t] = await Promise.all([listShopReviews(shopId), getTranslations("reviews")]);

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl font-bold">{t("title")}</h2>
      {reviews.length ? (
        <ul className="mt-3 divide-y border-y">
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review}>
              {review.status === "hidden" ? (
                <p className="text-sm text-muted-foreground">{t("hiddenBadge")}</p>
              ) : null}
              {!review.seller_reply && review.status === "published" ? <ReplyButton reviewId={review.id} /> : null}
            </ReviewItem>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-muted-foreground">{t("emptySeller")}</p>
      )}
    </div>
  );
}
