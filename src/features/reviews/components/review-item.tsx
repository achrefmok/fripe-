import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { formatDate } from "@/lib/utils/format";
import { RatingStars } from "./rating-stars";

type Review = {
  author_name: string;
  product_title: string;
  rating: number;
  comment: string | null;
  seller_reply: string | null;
  created_at: string;
};

export function ReviewItem({ review, children }: { review: Review; children?: ReactNode }) {
  const t = useTranslations("reviews");
  const locale = useLocale();

  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-1 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <RatingStars rating={review.rating} />
        <span className="font-semibold">{review.author_name}</span>
        <span className="text-sm text-muted-foreground">{formatDate(review.created_at, locale)}</span>
      </div>
      <p className="text-sm text-muted-foreground">{t("verified", { title: review.product_title })}</p>
      {review.comment ? <p className="leading-relaxed whitespace-pre-line">{review.comment}</p> : null}
      {review.seller_reply ? (
        <blockquote className="mt-1 border-s-2 border-harissa ps-3 text-sm">
          <span className="font-semibold">{t("shopReply")} : </span>
          {review.seller_reply}
        </blockquote>
      ) : null}
      {children}
    </li>
  );
}
