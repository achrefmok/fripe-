"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProduct, getPriceHint, updateProduct } from "@/features/catalog/actions";
import { CONDITIONS } from "@/features/catalog/constants";
import {
  brandSuggestions,
  COLORS,
  LETTER_SIZES,
  NUMBER_SIZES,
  ONE_SIZE,
  productKind,
  SHOE_SIZES,
} from "@/features/catalog/product-options";
import { productSchema } from "@/features/catalog/schemas";
import { useFormAction } from "@/hooks/use-form-action";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice, millimesToInput } from "@/lib/utils/price";
import { subcategoriesOf } from "../category-scope";

export type ProductValues = {
  title: string;
  categoryId: string;
  condition: string;
  price: string;
  brand: string;
  size: string;
  color: string;
  reference: string;
  description: string;
  defects: string;
  attributes: Record<string, string>;
};

export type FormCategory = { id: string; slug: string; nameFr: string; nameAr: string; parentId: string | null; section: string };
export type FormAttribute = {
  categoryId: string;
  key: string;
  labelFr: string;
  labelAr: string;
  kind: "choice" | "text";
  options: { value: string; fr: string; ar: string }[];
};

const EMPTY: ProductValues = {
  title: "",
  categoryId: "",
  condition: "",
  price: "",
  brand: "",
  size: "",
  color: "",
  reference: "",
  description: "",
  defects: "",
  attributes: {},
};

// Une rangée de puces : un choix en un geste, un second geste sur la même puce l'annule.
function Chips({
  label,
  options,
  value,
  onChange,
  name,
  latin = false,
}: {
  label: string;
  name: string;
  // Tailles et marques : toujours en caractères latins, isolées pour garder leur ordre en arabe (« Levi's », « 3XL »).
  latin?: boolean;
  options: { value: string; label: string; swatch?: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="chips">
      {options.map((option) => {
        const checked = value.toLowerCase() === option.value.toLowerCase();
        return (
          <label key={option.value} className={cn("chip", checked && "is-checked")}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              onClick={() => {
                if (checked) onChange("");
              }}
              className="sr-only"
            />
            {option.swatch ? <span className="chip__swatch" style={{ background: option.swatch }} aria-hidden="true" /> : null}
            {latin ? <bdi dir="ltr">{option.label}</bdi> : option.label}
            {checked ? <Check className="size-3.5" aria-hidden="true" /> : null}
          </label>
        );
      })}
    </div>
  );
}

export function ProductForm({
  shopId,
  productId,
  categories,
  attributes,
  shopBrands = [],
  defaults = EMPTY,
}: {
  shopId: string;
  productId?: string;
  categories: FormCategory[];
  attributes: FormAttribute[];
  shopBrands?: string[];
  defaults?: ProductValues;
}) {
  const t = useTranslations("sellerShop");
  const p = useTranslations("productForm");
  const conditions = useTranslations("conditions");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const ar = locale === "ar";
  const name = (item: { nameFr: string; nameAr: string }) => (ar ? item.nameAr : item.nameFr);

  const form = useForm<ProductValues, unknown, unknown>({
    resolver: zodResolver(productSchema) as never,
    defaultValues: { ...EMPTY, ...defaults, attributes: defaults.attributes ?? {} },
  });
  const values = useWatch({ control: form.control }) as ProductValues;
  const set = (field: keyof ProductValues, value: string) =>
    form.setValue(field, value as never, { shouldDirty: true, shouldValidate: Boolean(form.formState.errors[field]) });

  const selected = categories.find((category) => category.id === values.categoryId);
  const root = selected?.parentId ? categories.find((category) => category.id === selected.parentId) : selected;
  const kind = productKind(root?.slug);
  const roots = categories.filter((category) => !category.parentId);
  // Comme dans les filtres : sous « Chaussures », la précision propose aussi Sneakers, Baskets, Running…
  const children = root ? subcategoriesOf(categories, root) : [];
  // Le compilateur React mémorise ce calcul : pas de useMemo manuel.
  const relevant = selected
    ? attributes.filter((attribute) => attribute.categoryId === selected.id || attribute.categoryId === selected.parentId)
    : [];

  // Prix habituel de la catégorie, tiré des pièces en ligne.
  const [priceHint, setPriceHint] = useState<{ categoryId: string; data: { median: number; count: number } | null } | null>(null);
  useEffect(() => {
    if (!values.categoryId) return;
    let current = true;
    void getPriceHint(values.categoryId).then((result) => {
      if (current) setPriceHint({ categoryId: values.categoryId, data: result.ok ? result.data : null });
    });
    return () => {
      current = false;
    };
  }, [values.categoryId]);
  const hint = priceHint?.categoryId === values.categoryId ? priceHint.data : null;

  const sizeOptions =
    kind === "clothing"
      ? [...LETTER_SIZES, ...NUMBER_SIZES]
      : kind === "shoes"
        ? SHOE_SIZES
        : kind === "accessories"
          ? [ar ? ONE_SIZE.ar : ONE_SIZE.fr]
          : [];
  const brands = brandSuggestions(kind, shopBrands).slice(0, 10);
  const conditionLabel = values.condition ? conditions(values.condition as (typeof CONDITIONS)[number]) : "";
  const colorName = COLORS.find((color) => color.value === values.color);
  const shownColor = colorName && ar ? colorName.ar : values.color;

  const suggestedTitle = [selected ? name(selected) : "", values.brand, shownColor].filter(Boolean).join(" ").trim();
  const suggestedDescription = () => {
    const parts = [
      selected ? p("descCategory", { category: name(selected), brand: values.brand || "none" }) : "",
      values.size ? p(kind === "shoes" ? "descShoeSize" : "descSize", { size: values.size }) : "",
      shownColor ? p("descColor", { color: shownColor }) : "",
      ...relevant.flatMap((attribute) => {
        const option = attribute.options.find((entry) => entry.value === values.attributes?.[attribute.key]);
        return option ? [`${ar ? attribute.labelAr : attribute.labelFr} : ${ar ? option.ar : option.fr}.`] : [];
      }),
      conditionLabel ? p("descCondition", { condition: conditionLabel }) : "",
      values.defects ? p("descDefects", { defects: values.defects }) : "",
    ];
    return parts.filter(Boolean).join(" ");
  };

  const { submit, pending, error } = useFormAction(
    form,
    async (input) => {
      // Seules les caractéristiques de la catégorie choisie partent : changer de catégorie efface le reste.
      const payload = {
        ...input,
        attributes: Object.fromEntries(relevant.map((attribute) => [attribute.key, input.attributes?.[attribute.key] ?? ""])),
      };
      if (productId) return updateProduct(shopId, productId, payload);

      const result = await createProduct(shopId, payload);
      if (result.ok) router.push(`/vendeur/boutique/${shopId}/produits/${result.data.productId}`);
      return result.ok ? { ok: true, data: undefined } : result;
    },
    () => {
      toast.success(t("done"));
      router.refresh();
    },
  );

  // Une fois le rayon choisi, les autres se replient : le formulaire reste court.
  const [browsing, setBrowsing] = useState(false);
  const showRoots = !root || browsing;

  const { errors } = form.formState;
  const sections = [
    { key: "mode", label: nav("mode") },
    { key: "marketplace", label: nav("marketplace") },
  ].filter((section) => roots.some((category) => category.section === section.key));

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[0.8rem] font-semibold">{t("formCategory")}</legend>
        {showRoots ? sections.map((section) => (
          <div key={section.key} className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{section.label}</span>
            <Chips
              label={`${t("formCategory")} · ${section.label}`}
              name={`root-${section.key}`}
              value={root?.id ?? ""}
              onChange={(id) => {
                set("categoryId", id);
                set("size", "");
                setBrowsing(false);
              }}
              options={roots.filter((category) => category.section === section.key).map((category) => ({ value: category.id, label: name(category) }))}
            />
          </div>
        )) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip is-checked">
              {name(root!)}
              <Check className="size-3.5" aria-hidden="true" />
            </span>
            <button type="button" className="text-sm font-semibold underline underline-offset-4" onClick={() => setBrowsing(true)}>
              {p("changeCategory")}
            </button>
          </div>
        )}
        {children.length ? (
          <div className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{p("subcategory")}</span>
            <Chips
              label={p("subcategory")}
              name="subcategory"
              value={selected?.parentId ? selected.id : ""}
              onChange={(id) => set("categoryId", id || root!.id)}
              options={children.map((category) => ({ value: category.id, label: name(category) }))}
            />
          </div>
        ) : null}
      </fieldset>

      <div className="grid gap-1.5">
        <Field id="title" label={t("formTitle")} error={errors.title?.message}>
          <Input id="title" maxLength={120} aria-invalid={Boolean(errors.title)} {...form.register("title")} />
        </Field>
        {suggestedTitle && suggestedTitle !== values.title ? (
          <button type="button" className="suggestion" onClick={() => set("title", suggestedTitle)}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            {p("useTitle", { title: suggestedTitle })}
          </button>
        ) : null}
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-[0.8rem] font-semibold">{t("formCondition")}</legend>
        <div role="radiogroup" aria-label={t("formCondition")} className="chips">
          {CONDITIONS.map((condition) => (
            <label key={condition} className={cn("chip", values.condition === condition && "is-checked")}>
              <input type="radio" value={condition} className="sr-only" {...form.register("condition")} />
              {conditions(condition)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Field id="price" label={t("formPrice")} error={errors.price?.message}>
          <Input id="price" inputMode="decimal" aria-invalid={Boolean(errors.price)} {...form.register("price")} />
        </Field>
        {hint ? (
          <button type="button" className="suggestion" onClick={() => set("price", millimesToInput(hint.median))}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            {p("priceHint", { price: formatPrice(hint.median, locale), count: hint.count })}
          </button>
        ) : null}
      </div>

      {sizeOptions.length ? (
        <div className="grid gap-1.5">
          <Chips
            label={p(kind === "shoes" ? "shoeSizes" : "sizes")}
            name="size-chips"
            latin
            value={values.size}
            onChange={(value) => set("size", value)}
            options={sizeOptions.map((size) => ({ value: size, label: size }))}
          />
          <Field id="size" label={kind === "shoes" ? p("shoeSize") : t("formSize")} optional error={errors.size?.message}>
            <Input id="size" maxLength={20} placeholder={p("sizeOther")} {...form.register("size")} />
          </Field>
        </div>
      ) : null}

      {kind !== "other" ? (
        <div className="grid gap-1.5">
          <Chips
            label={p("colors")}
            name="color-chips"
            value={values.color}
            onChange={(value) => set("color", value)}
            options={COLORS.map((color) => ({ value: color.value, label: ar ? color.ar : color.value, swatch: color.swatch }))}
          />
          <Field id="color" label={t("formColor")} optional error={errors.color?.message}>
            <Input id="color" maxLength={40} {...form.register("color")} />
          </Field>
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Field id="brand" label={t("formBrand")} optional error={errors.brand?.message}>
          <Input id="brand" maxLength={60} list="brand-suggestions" autoComplete="off" {...form.register("brand")} />
        </Field>
        {brands.length ? (
          <>
            <datalist id="brand-suggestions">
              {brands.map((brand) => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
            <Chips
              label={p("brands")}
              name="brand-chips"
              latin
              value={values.brand}
              onChange={(value) => set("brand", value)}
              options={brands.slice(0, 8).map((brand) => ({ value: brand, label: brand }))}
            />
          </>
        ) : null}
      </div>

      {relevant.map((attribute) => (
        <fieldset key={attribute.key} className="grid gap-1.5">
          <legend className="mb-1 text-[0.8rem] font-semibold">
            {ar ? attribute.labelAr : attribute.labelFr}
            <span className="font-normal text-muted-foreground"> · {p("optional")}</span>
          </legend>
          {attribute.kind === "choice" ? (
            <Chips
              label={ar ? attribute.labelAr : attribute.labelFr}
              name={`attr-${attribute.key}`}
              value={values.attributes?.[attribute.key] ?? ""}
              onChange={(value) => form.setValue(`attributes.${attribute.key}`, value, { shouldDirty: true })}
              options={attribute.options.map((option) => ({ value: option.value, label: ar ? option.ar : option.fr }))}
            />
          ) : (
            <Input aria-label={ar ? attribute.labelAr : attribute.labelFr} maxLength={60} {...form.register(`attributes.${attribute.key}`)} />
          )}
        </fieldset>
      ))}

      <div className="grid gap-1.5">
        <Field id="description" label={t("formDescription")} optional error={errors.description?.message}>
          <Textarea id="description" rows={4} maxLength={2000} {...form.register("description")} />
        </Field>
        {selected ? (
          <button type="button" className="suggestion" onClick={() => set("description", suggestedDescription())}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            {p("writeDescription")}
          </button>
        ) : null}
      </div>

      <Field id="defects" label={t("formDefects")} hint={t("formDefectsHint")} optional error={errors.defects?.message}>
        <Textarea id="defects" rows={2} maxLength={500} {...form.register("defects")} />
      </Field>

      <details className="group" open={Boolean(errors.reference) || undefined}>
        <summary className="cursor-pointer text-sm font-semibold">{p("more")}</summary>
        <div className="mt-3">
          <Field id="reference" label={t("formReference")} hint={t("formReferenceHint")} optional error={errors.reference?.message}>
            <Input id="reference" dir="ltr" className="text-start" {...form.register("reference")} />
          </Field>
        </div>
      </details>

      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">
        {t("saveDraft")}
      </Button>
    </form>
  );
}
