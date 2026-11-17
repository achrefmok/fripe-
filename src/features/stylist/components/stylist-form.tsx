"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { addItemsToCart, recommendOutfits } from "@/features/stylist/actions";
import {
  COLORS,
  OCCASIONS,
  STYLES,
  type Color,
  type RecommendedOutfit,
  type StyleItem,
} from "@/features/stylist/engine";
import { Garment } from "@/features/home/components/garment";
import { universeFor } from "@/features/home/universes";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

// Les teintes des pastilles de couleur : la couleur elle-même, lisible sur papier comme sur nuit.
const SWATCHES: Record<Color, string> = {
  noir: "oklch(0.2 0.01 60)",
  blanc: "oklch(0.98 0.005 85)",
  gris: "oklch(0.65 0.01 80)",
  bleu: "oklch(0.5 0.12 255)",
  rouge: "oklch(0.55 0.19 28)",
  vert: "oklch(0.55 0.11 150)",
  beige: "oklch(0.86 0.045 80)",
  marron: "oklch(0.45 0.07 50)",
  rose: "oklch(0.78 0.09 0)",
  jaune: "oklch(0.86 0.15 95)",
};

export function OutfitPieces({ items }: { items: StyleItem[] }) {
  const locale = useLocale();

  return (
    <ul className="divide-y border-y">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/produit/${item.id}`} className="flex items-center gap-3 py-2.5">
            <span className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-cream">
              {item.imagePath ? (
                <Image src={productImageUrl(item.imagePath)} alt="" fill sizes="48px" className="object-cover" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.title}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {[item.brand, item.size, item.shopName].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="font-display text-lg">{formatPrice(item.priceMillimes, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StylistForm({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("stylist");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState({ size: "", shoeSize: "", budget: "", style: "", occasion: "" });
  const [colors, setColors] = useState<Color[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [outfits, setOutfits] = useState<RecommendedOutfit[] | null>(null);
  const [pending, startTransition] = useTransition();

  function addToCart(outfit: RecommendedOutfit) {
    if (!signedIn) {
      router.push({ pathname: "/connexion", query: { next: "/stylist" } });
      return;
    }

    startTransition(async () => {
      const result = await addItemsToCart(outfit.items.map((item) => item.id));

      if (result.ok) toast.success(t("addedToCart"));
      else toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-[30px]">
      <form
        noValidate
        className="lx-stylistform"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setFields({});

          startTransition(async () => {
            const result = await recommendOutfits({ ...values, colors });

            if (result.ok) setOutfits(result.data);
            else if (result.fields) setFields(result.fields);
            else setError(result.error);
          });
        }}
      >
        <p className="luxe-kicker">{t("formTitle")}</p>
        <div className="grid grid-cols-2 gap-4">
          <Field id="budget" label={t("budget")} error={fields.budget}>
            <Input
              id="budget"
              inputMode="decimal"
              value={values.budget}
              onChange={(event) => setValues({ ...values, budget: event.target.value })}
            />
          </Field>
          <Field id="size" label={t("size")}>
            <Input id="size" value={values.size} onChange={(event) => setValues({ ...values, size: event.target.value })} />
          </Field>
          <Field id="shoe-size" label={t("shoeSize")}>
            <Input
              id="shoe-size"
              value={values.shoeSize}
              onChange={(event) => setValues({ ...values, shoeSize: event.target.value })}
            />
          </Field>
          <Field id="style" label={t("style")}>
            <NativeSelect id="style" value={values.style} onChange={(event) => setValues({ ...values, style: event.target.value })}>
              <option value="">{t("any")}</option>
              {STYLES.map((style) => (
                <option key={style} value={style}>{t(`styles.${style}`)}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="occasion" label={t("occasion")}>
            <NativeSelect
              id="occasion"
              value={values.occasion}
              onChange={(event) => setValues({ ...values, occasion: event.target.value })}
            >
              <option value="">{t("any")}</option>
              {OCCASIONS.map((occasion) => (
                <option key={occasion} value={occasion}>{t(`occasions.${occasion}`)}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <fieldset>
          <legend className="text-[0.8rem] font-semibold">{t("colors")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <label key={color} className="lx-swatch">
                <input
                  type="checkbox"
                  className="lx-swatch__dot"
                  style={{ background: SWATCHES[color] }}
                  checked={colors.includes(color)}
                  onChange={() =>
                    setColors(colors.includes(color) ? colors.filter((value) => value !== color) : [...colors, color])
                  }
                />
                {t(`colorNames.${color}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <FormError error={error} />
        <Button type="submit" size="lg" disabled={pending} className="justify-self-start">
          {t("submit")}
        </Button>
      </form>

      <section className="min-w-0 flex-[1_1_420px]" aria-live="polite" aria-busy={pending}>
        {outfits ? (
          outfits.length ? (
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
              {outfits.map((outfit, index) => (
                <article key={outfit.items.map((item) => item.id).join()} className="lx-stylistcard">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-2xl font-normal">{t("outfitNumber", { number: index + 1 })}</h2>
                    <p className="font-display text-2xl text-goldink">
                      {formatPrice(outfit.totalMillimes, locale)}
                    </p>
                  </div>
                  <OutfitPieces items={outfit.items} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" disabled={pending} onClick={() => addToCart(outfit)}>{t("addToCart")}</Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={{ pathname: "/tenues/nouvelle", query: { pieces: outfit.items.map((item) => item.id).join(",") } }}>
                        {t("openBuilder")}
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p role="status" className="lx-stylistwait text-muted-foreground">{t("noResult")}</p>
          )
        ) : (
          <div className="lx-stylistwait">
            <span className="flex items-end gap-2" aria-hidden="true">
              {["hauts", "bas", "chaussures"].map((slug) => (
                <Garment key={slug} universe={universeFor(slug)} className="h-16 w-14" />
              ))}
            </span>
            <p className="font-display text-2xl">{t("waitingTitle")}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t("waitingBody")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
