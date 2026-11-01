import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function RatingStars({ rating, className }: { rating: number; className?: string }) {
  const t = useTranslations("reviews");

  return (
    <span role="img" aria-label={t("ratingLabel", { rating })} className={cn("inline-flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden
          className={cn("size-4", value <= rating ? "fill-harissa text-harissa" : "text-muted-foreground")}
        />
      ))}
    </span>
  );
}
