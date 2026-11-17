"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitArrival, withdrawArrival } from "@/features/arrivals/actions";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

const MAX_PIECES = 12;

type Candidate = { id: string; title: string; priceMillimes: number; imagePath: string | null };

// Annoncer un arrivage : un titre, puis les pièces choisies d'un geste parmi celles déjà en ligne.
export function ArrivalForm({ shopId, candidates }: { shopId: string; candidates: Candidate[] }) {
  const t = useTranslations("arrivals");
  const locale = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : current.length < MAX_PIECES ? [...current, id] : current,
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setFields({});
        startTransition(async () => {
          const result = await submitArrival(shopId, { title, note, productIds: picked });
          if (result.ok) {
            toast.success(t("submitted"));
            setTitle("");
            setNote("");
            setPicked([]);
            router.refresh();
            return;
          }
          setFields(result.fields ?? {});
          setError(result.fields ? null : result.error);
        });
      }}
    >
      <Field id="arrival-title" label={t("title")} hint={t("titleHint")} error={fields.title}>
        <Input id="arrival-title" maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field id="arrival-note" label={t("note")} optional error={fields.note}>
        <Textarea id="arrival-note" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="mb-1 flex w-full items-baseline justify-between gap-3 text-[0.8rem] font-semibold">
          {t("pieces")}
          <span className="font-normal tabular-nums text-muted-foreground" aria-live="polite">
            {t("piecesCount", { count: picked.length, max: MAX_PIECES })}
          </span>
        </legend>
        {candidates.length ? (
          <ul className="arrival-picker">
            {candidates.map((candidate) => {
              const checked = picked.includes(candidate.id);
              return (
                <li key={candidate.id}>
                  <label className={cn("arrival-pick", checked && "is-checked")}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      disabled={!checked && picked.length >= MAX_PIECES}
                      onChange={() => toggle(candidate.id)}
                    />
                    <span className="arrival-pick__photo">
                      {candidate.imagePath ? (
                        <Image src={productImageUrl(candidate.imagePath)} alt="" fill sizes="8rem" className="object-cover" />
                      ) : null}
                      {checked ? (
                        <span className="arrival-pick__check" aria-hidden="true">
                          <Check className="size-4" strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                    <span className="arrival-pick__title" dir="auto">{candidate.title}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{formatPrice(candidate.priceMillimes, locale)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noCandidates")}</p>
        )}
        {fields.productIds ? <p role="alert" className="text-[0.8rem] font-medium text-destructive">{t("piecesRequired")}</p> : null}
      </fieldset>

      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending || !candidates.length} className="w-full sm:w-auto sm:justify-self-start">
        {t("submit")}
      </Button>
    </form>
  );
}

export function WithdrawArrivalButton({ shopId, arrivalId }: { shopId: string; arrivalId: string }) {
  const t = useTranslations("arrivals");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await withdrawArrival(shopId, arrivalId);
          if (result.ok) {
            toast.success(t("withdrawn"));
            router.refresh();
          } else toast.error(t("withdrawFailed"));
        })
      }
    >
      {t("withdraw")}
    </Button>
  );
}
