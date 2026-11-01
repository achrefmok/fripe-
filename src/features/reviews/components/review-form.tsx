"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { createReview } from "@/features/reviews/actions";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function ReviewForm({ orderItemId, title }: { orderItemId: string; title: string }) {
  const t = useTranslations("reviews");
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [missingRating, setMissingRating] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="grid grid-cols-[minmax(0,1fr)] gap-3 bg-secondary p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMissingRating(false);

        startTransition(async () => {
          const result = await createReview({ orderItemId, rating, comment });

          if (result.ok) {
            toast.success(t("sent"));
            router.refresh();
          } else if (result.fields?.rating) {
            setMissingRating(true);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <fieldset>
        <legend className="text-[0.8rem] font-semibold">{t("rateItem", { title })}</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="flex size-11 cursor-pointer items-center justify-center">
              <input
                type="radio"
                name={`rating-${orderItemId}`}
                className="peer sr-only"
                aria-label={t("ratingLabel", { rating: value })}
                checked={rating === value}
                onChange={() => setRating(value)}
              />
              <Star
                aria-hidden
                className={cn(
                  "size-7 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                  value <= rating ? "fill-harissa text-harissa" : "text-muted-foreground",
                )}
              />
            </label>
          ))}
        </div>
        {missingRating ? (
          <p role="alert" className="pt-1 text-[0.8rem] font-medium text-destructive">{t("ratingRequired")}</p>
        ) : null}
      </fieldset>
      <Field id={`comment-${orderItemId}`} label={t("comment")} optional>
        <Textarea
          id={`comment-${orderItemId}`}
          maxLength={1000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="sm" className="justify-self-start" disabled={pending}>{t("publish")}</Button>
    </form>
  );
}
