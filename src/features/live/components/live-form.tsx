"use client";

import { Check, ImageIcon } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import { saveLive } from "../actions";
import type { Live, LiveProduct } from "../queries";

// Un champ « datetime-local » parle l'heure du téléphone, sans fuseau : on convertit dans les deux sens.
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Programmer ou modifier un Live : un titre, une date facultative, et les pièces qu'on présentera.
// La couverture est la photo d'une des pièces choisies.
export function LiveForm({ shopId, live, candidates }: { shopId: string; live?: Live; candidates: LiveProduct[] }) {
  const t = useTranslations("live");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const onAir = live?.status === "live";
  const [title, setTitle] = useState(live?.title ?? "");
  const [description, setDescription] = useState(live?.description ?? "");
  const [date, setDate] = useState(toLocalInput(live?.scheduledAt ?? null));
  const [selected, setSelected] = useState<string[]>(live?.products.map((product) => product.id) ?? []);
  const [cover, setCover] = useState<string>(live?.coverProductId ?? "");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Les pièces déjà dans le Live restent proposées, même si elles ne sont plus disponibles.
  const options = [...candidates, ...(live?.products.filter((product) => !candidates.some((candidate) => candidate.id === product.id)) ?? [])];

  function toggle(productId: string) {
    setSelected((list) => {
      if (list.includes(productId)) {
        if (cover === productId) setCover("");
        return list.filter((id) => id !== productId);
      }
      return list.length >= 30 ? list : [...list, productId];
    });
  }

  function submit() {
    setError(null);
    setFields({});

    startTransition(async () => {
      const result = await saveLive(shopId, live?.id ?? null, {
        title,
        description,
        scheduledAt: date ? new Date(date).toISOString() : "",
        productIds: selected,
        coverProductId: cover && selected.includes(cover) ? cover : "",
      });

      if (result.ok) {
        toast.success(t("saved"));
        if (live) router.refresh();
        else router.push(`/vendeur/boutique/${shopId}/lives/${result.data.liveId}`);
      } else if (result.fields) {
        setFields(result.fields);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      noValidate
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field id="live-title" label={t("fieldTitle")} error={fields.title} hint={t("fieldTitleHint")}>
        <Input id="live-title" value={title} maxLength={80} disabled={onAir} onChange={(event) => setTitle(event.target.value)} />
      </Field>

      <Field id="live-description" label={t("fieldDescription")} error={fields.description}>
        <Textarea id="live-description" rows={3} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>

      {onAir ? null : (
        <Field id="live-date" label={t("fieldDate")} error={fields.scheduledAt} hint={t("fieldDateHint")}>
          <Input id="live-date" type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className="max-w-xs" />
        </Field>
      )}

      <fieldset className="min-w-0">
        <legend className="text-[0.8rem] font-semibold">{t("fieldProducts")}</legend>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("fieldProductsHint", { count: selected.length })}</p>
        {options.length ? (
          <ul className="live-picker">
            {options.map((product) => {
              const checked = selected.includes(product.id);
              const isCover = checked && (cover === product.id || (!cover && selected[0] === product.id));
              return (
                <li key={product.id} className={cn("live-picker__item", checked && "is-checked")}>
                  <label className="live-picker__label">
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(product.id)} />
                    <span className="live-picker__photo">
                      {product.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="8rem" className="object-cover" /> : null}
                      <span className="live-picker__check" aria-hidden="true">
                        <Check className="size-3.5" />
                      </span>
                      {isCover ? <span className="live-picker__cover">{t("coverBadge")}</span> : null}
                    </span>
                    <span className="mt-1.5 block truncate text-xs font-medium" dir="auto">{product.title}</span>
                    <span className="block text-xs text-muted-foreground">{formatPrice(product.priceMillimes, locale)}</span>
                  </label>
                  {checked && !isCover ? (
                    <button type="button" className="live-picker__setcover" aria-label={t("coverChoose", { title: product.title })} onClick={() => setCover(product.id)}>
                      <ImageIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("noCandidates")}</p>
        )}
        {fields.productIds ? <p className="mt-1 text-sm text-destructive">{errors.has(fields.productIds) ? errors(fields.productIds) : errors("invalidInput")}</p> : null}
      </fieldset>

      <FormError error={error ? (errors.has(error) ? error : "unexpected") : null} />
      <Button type="submit" size="lg" disabled={pending} className="justify-self-start">{t("save")}</Button>
    </form>
  );
}
