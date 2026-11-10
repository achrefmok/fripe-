"use client";

import { Check, Dices, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addItemsToCart, saveOutfit, searchSlotItems, suggestCheaperOutfit } from "@/features/stylist/actions";
import { outfitTotal, SLOTS, type Slot, type StyleItem } from "@/features/stylist/engine";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice, parsePriceToMillimes } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";
import { FittingBooth } from "./fitting-booth";

// Le curseur du budget, en dinars : de quoi couvrir une tenue de friperie, du petit au grand budget.
const RANGE_MIN = 30;
const RANGE_MAX = 300;

function HangerHook() {
  return (
    <svg viewBox="0 0 100 40" className="lx-hook lx-cabrail__hook" aria-hidden="true">
      <path d="M50 3c4 0 6 4 3 7-2 1-3 2-3 5" />
      <path d="M50 15 8 36h84z" />
    </svg>
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
  const [slot, setSlot] = useState<Slot>("top");
  const [search, setSearch] = useState("");
  const [rail, setRail] = useState<StyleItem[] | null>(null);
  const [railLoading, setRailLoading] = useState(true);
  const [name, setName] = useState(initialName);
  const [budget, setBudget] = useState(initialBudget);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Seule la dernière recherche compte : une réponse plus ancienne n'écrase jamais la nouvelle.
  const request = useRef(0);

  const selected = SLOTS.flatMap((key) => (pieces[key] ? [pieces[key]] : []));
  const total = outfitTotal(selected);
  const budgetMillimes = budget ? parsePriceToMillimes(budget) : null;
  const overBudget = budgetMillimes !== null && total > budgetMillimes;
  const ratio = budgetMillimes ? Math.min(1, total / budgetMillimes) : 0;
  const rangeValue = Math.min(RANGE_MAX, Math.max(RANGE_MIN, budgetMillimes ? Math.round(budgetMillimes / 1000) : RANGE_MIN));

  async function loadRail(target: Slot, term: string) {
    const id = ++request.current;
    setRailLoading(true);
    const result = await searchSlotItems(target, term);
    if (id !== request.current) return;
    setRail(result.ok ? result.data : []);
    setRailLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    const id = ++request.current;
    searchSlotItems("top", "").then((result) => {
      if (cancelled || id !== request.current) return;
      setRail(result.ok ? result.data : []);
      setRailLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function choose(target: Slot) {
    setSlot(target);
    setSearch("");
    void loadRail(target, "");
  }

  function pick(item: StyleItem) {
    setPieces((current) => ({ ...current, [slot]: item }));
  }

  function remove(target: Slot) {
    setPieces((current) => ({ ...current, [target]: undefined }));
  }

  function requireAccount() {
    if (signedIn) return true;
    router.push({ pathname: "/connexion", query: { next: "/tenues/nouvelle" } });
    return false;
  }

  function randomLook() {
    startTransition(async () => {
      const results = await Promise.all(SLOTS.map((key) => searchSlotItems(key, "")));
      const next: Partial<Record<Slot, StyleItem>> = {};
      SLOTS.forEach((key, index) => {
        const result = results[index];
        if (result.ok && result.data.length) next[key] = result.data[Math.floor(Math.random() * result.data.length)];
      });
      if (!Object.keys(next).length) {
        toast.info(t("randomEmpty"));
        return;
      }
      setPieces(next);
    });
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

  function addLookToCart() {
    if (!requireAccount()) return;

    startTransition(async () => {
      const result = await addItemsToCart(selected.map((item) => item.id));
      if (result.ok) toast.success(t("addedToCart"));
      else setError(result.error);
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
    <div className="flex flex-wrap items-start gap-[30px]">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
        <div role="group" aria-label={t("lookLabel")} className="flex flex-wrap gap-2">
          {SLOTS.map((key) => {
            const label = t(`slots.${key}`);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={slot === key}
                aria-label={`${pieces[key] ? t("replace") : t("choose")} ${label}`}
                onClick={() => choose(key)}
                className={cn("lx-cabchip", slot === key && "is-active")}
              >
                {pieces[key] ? <Check className="size-3.5" aria-hidden="true" /> : null}
                {label}
              </button>
            );
          })}
        </div>

        <form
          className="lx-cabsearch"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void loadRail(slot, search);
          }}
        >
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" className="lx-cabsearch__go" disabled={railLoading}>{t("searchSubmit")}</button>
        </form>

        <div className="lx-cabrail" aria-busy={railLoading}>
          <span className="lx-cabrail__rod" aria-hidden="true" />
          {rail?.length ? (
            <ul className="lx-cabrail__row rail-scroll" aria-label={t("railLabel", { slot: t(`slots.${slot}`) })}>
              {rail.map((item) => {
                const chosen = pieces[slot]?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="lx-cabrail__piece"
                      data-chosen={chosen ? "" : undefined}
                      aria-pressed={chosen}
                      aria-label={`${item.title} ${formatPrice(item.priceMillimes, locale)}`}
                      onClick={() => pick(item)}
                    >
                      <HangerHook />
                      <span className="lx-cabrail__photo">
                        {item.imagePath ? <Image src={productImageUrl(item.imagePath)} alt="" fill unoptimized sizes="6rem" className="object-cover" /> : null}
                      </span>
                      <span className="mt-1.5 text-xs font-semibold tabular-nums">{formatPrice(item.priceMillimes, locale)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-1 pb-4 pt-6 text-sm text-muted-foreground">{railLoading ? t("loading") : t("noPieces")}</p>
          )}
        </div>

        <div className="lx-cabbudget">
          <div className="flex items-baseline justify-between gap-3">
            <span className="luxe-kicker">{t("budgetKicker")}</span>
            <span className="font-display text-[28px] leading-none">{budgetMillimes ? formatPrice(budgetMillimes, locale) : t("noBudget")}</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-end gap-3">
            <input
              type="range"
              min={RANGE_MIN}
              max={RANGE_MAX}
              step={5}
              value={rangeValue}
              aria-label={t("budgetRange")}
              onChange={(event) => setBudget(event.target.value)}
              className="h-9 w-full accent-[var(--harissa)]"
            />
            <Field id="outfit-budget" label={t("budget")} error={fields.budget}>
              <Input id="outfit-budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} />
            </Field>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cream" aria-hidden="true">
            <div
              className="h-full rounded-full transition-[width,background-color] duration-500"
              style={{ width: `${Math.round(ratio * 100)}%`, background: overBudget ? "var(--destructive)" : "var(--gold)" }}
            />
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-2.5 text-sm">
            <span>
              {t("lookTotal")}{" "}
              <strong data-testid="outfit-total" className={cn("font-display text-xl font-medium", overBudget && "text-destructive")}>
                {formatPrice(total, locale)}
              </strong>
            </span>
            {overBudget ? (
              <span role="alert" className="font-semibold text-destructive">{t("overBudget")}</span>
            ) : budgetMillimes && selected.length ? (
              <span className="font-semibold text-goldink">{t("withinBudget")}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-[1_1_340px] flex-col items-center gap-5">
        <FittingBooth pieces={pieces} activeSlot={slot} onSelect={choose} onRemove={remove}>
          <button type="button" className="lx-cabbtn flex-[1_1_120px]" onClick={randomLook} disabled={pending}>
            <Dices className="size-4" aria-hidden="true" />
            {t("random")}
          </button>
          <button type="button" className="lx-cabbtn lx-cabbtn--gold flex-[1_1_100%]" onClick={addLookToCart} disabled={pending || !selected.length}>
            {t("addToCart")}
          </button>
        </FittingBooth>

        <div className="lx-cabsave">
          <p className="luxe-kicker">{t("saveKicker")}</p>
          <Field id="outfit-name" label={t("name")} error={fields.name}>
            <Input id="outfit-name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-[var(--harissa)]" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
            {t("public")}
          </label>
          <FormError error={error ? (errors.has(error) ? error : "unexpected") : null} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="lx-cabbtn lx-cabbtn--ink" disabled={pending || !selected.length} onClick={save}>
              {t("save")}
            </button>
            <button type="button" className="lx-cabbtn" disabled={pending || !selected.length} onClick={findCheaper}>
              {t("cheaper")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
