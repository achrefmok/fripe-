"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { sectionAttributes } from "@/features/catalog/audience";
import { CONDITIONS } from "@/features/catalog/constants";
import { useRouter } from "@/i18n/navigation";
import { createListing, updateListing } from "../actions";
import type { CategoryAttribute } from "../queries";
import type { ListingSection } from "../schemas";

type Category = { id: string; nameFr: string; nameAr: string; parentId: string | null };
type Governorate = { id: number; nameFr: string; nameAr: string; cities: { id: number; nameFr: string; nameAr: string }[] };

export type ListingFormValues = {
  categoryId: string;
  title: string;
  description: string;
  brand: string;
  size: string;
  condition: string;
  price: string;
  governorateId: string;
  cityId: string;
  attributes: Record<string, string>;
  // Description des défauts, ou « aucun défaut » coché : l'un des deux est obligatoire.
  defects: string;
  noDefects: boolean;
};

export function ListingForm({
  section,
  listingId,
  initial,
  categories,
  attributes,
  governorates,
}: {
  section: ListingSection;
  listingId?: string;
  initial: ListingFormValues;
  categories: Category[];
  attributes: CategoryAttribute[];
  governorates: Governorate[];
}) {
  const t = useTranslations("market");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = (option: { nameFr: string; nameAr: string }) => (locale === "ar" ? option.nameAr : option.nameFr);

  const roots = categories.filter((category) => !category.parentId);
  const selected = categories.find((category) => category.id === values.categoryId);
  // Les caractéristiques de la catégorie choisie, puis celles de sa racine.
  const relevant = useMemo(
    () =>
      selected
        ? sectionAttributes(
            section,
            attributes.filter((attribute) => attribute.categoryId === selected.id || attribute.categoryId === selected.parentId),
          )
        : [],
    [attributes, section, selected],
  );
  const cities = governorates.find((governorate) => String(governorate.id) === values.governorateId)?.cities ?? [];

  function set<K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setFields({});

        const input = {
          ...values,
          section,
          attributes: Object.fromEntries(relevant.map((attribute) => [attribute.key, values.attributes[attribute.key] ?? ""])),
        };

        startTransition(async () => {
          if (listingId) {
            const result = await updateListing(listingId, input);
            if (result.ok) {
              toast.success(t("saved"));
              router.refresh();
            } else {
              setFields(result.fields ?? {});
              setError(result.fields ? null : result.error);
            }
            return;
          }

          const result = await createListing(input);
          if (result.ok) router.push(`/compte/annonces/${result.data.listingId}?photos=1`);
          else {
            setFields(result.fields ?? {});
            setError(result.fields ? null : result.error);
          }
        });
      }}
    >
      <Field id="l-title" label={t("fieldTitle")} error={fields.title}>
        <Input id="l-title" value={values.title} maxLength={120} required onChange={(event) => set("title", event.target.value)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="l-category" label={t("fieldCategory")} error={fields.categoryId}>
          <NativeSelect id="l-category" value={values.categoryId} required onChange={(event) => set("categoryId", event.target.value)}>
            <option value="">{t("chooseCategory")}</option>
            {roots.map((root) => (
              <optgroup key={root.id} label={label(root)}>
                <option value={root.id}>{label(root)}</option>
                {categories
                  .filter((category) => category.parentId === root.id)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {label(category)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>

        <Field id="l-condition" label={t("fieldCondition")} error={fields.condition}>
          <NativeSelect id="l-condition" value={values.condition} required onChange={(event) => set("condition", event.target.value)}>
            <option value="">{t("chooseCondition")}</option>
            {CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {conditions(condition)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      {relevant.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {relevant.map((attribute) => (
            <Field key={attribute.key} id={`l-a-${attribute.key}`} label={locale === "ar" ? attribute.labelAr : attribute.labelFr} optional error={fields[`attributes.${attribute.key}`]}>
              {attribute.kind === "choice" ? (
                <NativeSelect
                  id={`l-a-${attribute.key}`}
                  value={values.attributes[attribute.key] ?? ""}
                  onChange={(event) => set("attributes", { ...values.attributes, [attribute.key]: event.target.value })}
                >
                  <option value="">—</option>
                  {attribute.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {locale === "ar" ? option.ar : option.fr}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  id={`l-a-${attribute.key}`}
                  maxLength={60}
                  value={values.attributes[attribute.key] ?? ""}
                  onChange={(event) => set("attributes", { ...values.attributes, [attribute.key]: event.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="l-price" label={t("fieldPrice")} error={fields.price}>
          <Input id="l-price" inputMode="decimal" value={values.price} required onChange={(event) => set("price", event.target.value)} />
        </Field>
        <Field id="l-brand" label={t("fieldBrand")} optional error={fields.brand}>
          <Input id="l-brand" maxLength={60} value={values.brand} onChange={(event) => set("brand", event.target.value)} />
        </Field>
        {section === "vide_dressing" ? (
          <Field id="l-size" label={t("fieldSize")} optional error={fields.size}>
            <Input id="l-size" maxLength={20} value={values.size} onChange={(event) => set("size", event.target.value)} />
          </Field>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="l-governorate" label={t("fieldGovernorate")} error={fields.governorateId}>
          <NativeSelect
            id="l-governorate"
            value={values.governorateId}
            required
            onChange={(event) => setValues((current) => ({ ...current, governorateId: event.target.value, cityId: "" }))}
          >
            <option value="">{t("chooseGovernorate")}</option>
            {governorates.map((governorate) => (
              <option key={governorate.id} value={governorate.id}>
                {label(governorate)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="l-city" label={t("fieldCity")} optional error={fields.cityId}>
          <NativeSelect id="l-city" value={values.cityId} disabled={!cities.length} onChange={(event) => set("cityId", event.target.value)}>
            <option value="">{t("chooseCity")}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {label(city)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field id="l-description" label={t("fieldDescription")} hint={t("descriptionHint")} optional error={fields.description}>
        <Textarea id="l-description" rows={6} maxLength={3000} value={values.description} onChange={(event) => set("description", event.target.value)} />
      </Field>

      <Field id="l-defects" label={t("fieldDefects")} hint={t("defectsHint")} error={fields.defects}>
        <Textarea
          id="l-defects"
          rows={3}
          maxLength={500}
          value={values.noDefects ? "" : values.defects}
          disabled={values.noDefects}
          onChange={(event) => set("defects", event.target.value)}
        />
      </Field>
      <label className="-mt-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-foreground"
          checked={values.noDefects}
          onChange={(event) => set("noDefects", event.target.checked)}
        />
        {t("noDefects")}
      </label>

      <FormError error={error} />

      <Button type="submit" className="h-12 justify-self-start px-6" disabled={pending}>
        {listingId ? t("submitSave") : t("submitCreate")}
      </Button>
    </form>
  );
}
