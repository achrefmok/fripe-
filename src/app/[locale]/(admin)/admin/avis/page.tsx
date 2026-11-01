import { getTranslations } from "next-intl/server";
import { Pagination } from "@/features/admin/components/pagination";
import { ModerateReviewButton } from "@/features/reviews/components/review-actions";
import { ReviewItem } from "@/features/reviews/components/review-item";
import { listAllReviews, REVIEW_PAGE_SIZE } from "@/features/reviews/queries";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";

const STATUSES = ["published", "hidden"] as const;

export default async function AdminReviewsPage({ searchParams }: PageProps<"/[locale]/admin/avis">) {
  await requireAdmin("/admin/avis");
  const { statut, page } = await searchParams;

  const status = STATUSES.find((value) => value === statut) ?? "published";
  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ reviews, total }, t] = await Promise.all([
    listAllReviews(status, currentPage),
    getTranslations("reviews"),
  ]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>

      <nav aria-label={t("title")} className="mt-4 flex gap-1">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`/admin/avis?statut=${value}`}
            aria-current={value === status ? "true" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center px-3 text-sm font-medium",
              value === status ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`status.${value}`)}
          </Link>
        ))}
      </nav>

      {reviews.length ? (
        <ul className="mt-4 divide-y border-y">
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review}>
              <p className="text-sm text-muted-foreground">{review.shops?.name}</p>
              <ModerateReviewButton reviewId={review.id} status={review.status} />
            </ReviewItem>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("empty")}</p>
      )}

      <Pagination
        page={currentPage}
        total={total}
        pageSize={REVIEW_PAGE_SIZE}
        basePath="/admin/avis"
        params={{ statut: status }}
      />
    </>
  );
}
