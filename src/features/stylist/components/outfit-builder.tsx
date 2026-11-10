"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addItemsToCart, saveOutfit, searchSlotItems, suggestCheaperOutfit } from "@/features/stylist/actions";
import { outfitTotal, SLOTS, type Slot, type StyleItem } from "@/features/stylist/engine";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice, parsePriceToMillimes } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";
import { FittingBooth } from "./fitting-booth";

function SlotPicker({ slot, onPick }: { slot: Slot; onPick: (item: StyleItem) => void }) {
  const t = useTranslations("outfits");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<StyleItem[] | null>(null);
  const [pending, startTransition] = useTransition();

  function load(term: string) {
    startTransition(async () => {
      const result = await searchSlotItems(slot, term);
      if (result.ok) setItems(result.data);
    });
  }

  return (
    <div className="mt-2 rounded-2xl bg-secondary p-3">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          load(search);
        }}
      >
        <Input
          aria-label={t("search")}
          placeholder={t("search")}
          className="h-10 flex-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={pending}>{t("searchSubmit")}</Button>
      </form>
      {items ? (
        items.length ? (
          <ul className="mt-2 max-h-64 divide-y overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onPick(item)} className="flex w-full items-center gap-2 py-2 text-start text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                  <span className="shrink-0">{formatPrice(item.priceMillimes, locale)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("noPieces")}</p>
        )
      ) : null}
    </div>
  );
}

export function OutfitBuilder({
  signedIn,
  outfitId = null,
  initial = {},
  initialName = "",
  initialBudget = "",
  initialPublic = false,
}: {
  signedIn: boolean;
  outfitId?: string | null;
  initial?: Partial<Record<Slot, StyleItem>>;
  initialName?: string;
  initialBudget?: string;
  initialPublic?: boolean;
}) {
  const t = useTranslations("outfits");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [pieces, setPieces] = useState(initial);
  const [picking, setPicking] = useState<Slot | null>(null);
  const [name, setName] = useState(initialName);
  const [budget, setBudget] = useState(initialBudget);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = SLOTS.flatMap((slot) => (pieces[slot] ? [pieces[slot]] : []));
  const total = outfitTotal(selected);
  const budgetMillimes = budget ? parsePriceToMillimes(budget) : null;
  const overBudget = budgetMillimes !== null && total > budgetMillimes;

  function requireAccount() {
    if (signedIn) return true;
    router.push({ pathname: "/connexion", query: { next: "/tenues/nouvelle" } });
    return false;
  }

  function findCheaper() {
    startTransition(async () => {
      const result = await suggestCheaperOutfit(selected.map((item) => item.id));

      if (!result.ok) {
        setError(result.error);
      } else if (!result.data) {
        toast.info(t("noCheaper"));
      } else {
        const next = { ...pieces };
        result.data.items.forEach((item) => {
          next[item.slot] = item;
        });
        setPieces(next);
        toast.success(t("cheaperFound", { amount: formatPrice(result.data.savingMillimes, locale) }));
      }
    });
  }

  function save() {
    if (!requireAccount()) return;

    setError(null);
    setFields({});

    startTransition(async () => {
      const result = await saveOutfit({
        outfitId,
        name,
        budget,
        isPublic,
        items: selected.map((item) => ({ slot: item.slot, productId: item.id })),
      });

      if (result.ok) {
        toast.success(t("saved"));
        router.push(`/tenues/${result.data.outfitId}`);
      } else if (result.fields) {
        setFields(result.fields);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <FittingBooth pieces={pieces} total={total} budget={budgetMillimes} />
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {SLOTS.map((slot) => {
          const piece = pieces[slot];

          return (
            <li key={slot} className="border-b pb-3">
              <div className="flex items-center gap-3">
                <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary">
                  {piece?.imagePath ? (
                    <Image src={productImageUrl(piece.imagePath)} alt="" fill unoptimized sizes="48px" className="object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8rem] font-semibold text-muted-foreground">{t(`slots.${slot}`)}</span>
                  <span className="block truncate font-semibold">{piece?.title ?? t("emptySlot")}</span>
                  {piece ? <span className="block text-sm">{formatPrice(piece.priceMillimes, locale)}</span> : null}
                </span>
                <div className="flex flex-col items-end gap-1 text-sm font-medium">
                  <button
                    type="button"
                    className="underline underline-offset-4"
                    aria-expanded={picking === slot}
                    aria-label={`${piece ? t("replace") : t("choose")} ${t(`slots.${slot}`)}`}
                    onClick={() => setPicking(picking === slot ? null : slot)}
                  >
                    {piece ? t("replace") : t("choose")}
                  </button>
                  {piece ? (
                    <button
                      type="button"
                      className="underline underline-offset-4"
                      aria-label={`${t("remove")} ${t(`slots.${slot}`)}`}
                      onClick={() => setPieces({ ...pieces, [slot]: undefined })}
                    >
                      {t("remove")}
                    </button>
                  ) : null}
                </div>
              </div>
              {picking === slot ? (
                <SlotPicker
                  slot={slot}
                  onPick={(item) => {
                    setPieces({ ...pieces, [slot]: item });
                    setPicking(null);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-4">
        <Field id="outfit-name" label={t("name")} error={fields.name}>
          <Input id="outfit-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="outfit-budget" label={t("budget")} error={fields.budget}>
          <Input id="outfit-budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} />
        </Field>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{t("total")}</span>
        <span data-testid="outfit-total" className={cn("font-display text-2xl font-extrabold", overBudget && "text-destructive")}>
          {formatPrice(total, locale)}
        </span>
      </div>
      {overBudget ? (
        <p role="alert" className="text-sm font-medium text-destructive">{t("overBudget")}</p>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-[var(--harissa)]"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
        />
        {t("public")}
      </label>

      <FormError error={error ? (errors.has(error) ? error : "unexpected") : null} />

      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || !selected.length} onClick={save}>{t("save")}</Button>
        <Button variant="outline" disabled={pending || !selected.length} onClick={findCheaper}>
          {t("cheaper")}
        </Button>
        <Button
          variant="outline"
          disabled={pending || !selected.length}
          onClick={() => {
            if (!requireAccount()) return;

            startTransition(async () => {
              const result = await addItemsToCart(selected.map((item) => item.id));
              if (result.ok) toast.success(t("addedToCart"));
              else setError(result.error);
            });
          }}
        >
          {t("addToCart")}
        </Button>
      </div>
    </div>
  );
}
