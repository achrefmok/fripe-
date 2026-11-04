"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { savePlatformDeliveryRates } from "@/features/orders/actions";
import { useRouter } from "@/i18n/navigation";

// Un tarif par défaut, puis un tarif par gouvernorat ; laissé vide, un gouvernorat suit le défaut.
export function PlatformDeliveryForm({
  governorates,
  defaultFee,
  rates,
}: {
  governorates: { id: number; nameFr: string; nameAr: string }[];
  defaultFee: string;
  rates: Record<string, string>;
}) {
  const t = useTranslations("delivery");
  const locale = useLocale();
  const router = useRouter();
  const [fallback, setFallback] = useState(defaultFee);
  const [values, setValues] = useState(rates);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setFields({});
        startTransition(async () => {
          const result = await savePlatformDeliveryRates(fallback, values);
          if (result.ok) {
            toast.success(t("saved"));
            router.refresh();
          } else {
            setFields(result.fields ?? {});
            setError(result.fields ? null : result.error);
          }
        });
      }}
    >
      <Field id="default-fee" label={t("defaultFee")} hint={t("defaultFeeHint")} error={fields.default}>
        <Input id="default-fee" inputMode="decimal" className="max-w-40" value={fallback} onChange={(event) => setFallback(event.target.value)} />
      </Field>

      <fieldset>
        <legend className="text-sm font-semibold">{t("byGovernorate")}</legend>
        <p className="mt-1 text-sm text-muted-foreground">{t("byGovernorateHint")}</p>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {governorates.map((governorate) => (
            <Field
              key={governorate.id}
              id={`fee-${governorate.id}`}
              label={locale === "ar" ? governorate.nameAr : governorate.nameFr}
              error={fields[String(governorate.id)]}
            >
              <Input
                id={`fee-${governorate.id}`}
                inputMode="decimal"
                placeholder={fallback}
                value={values[String(governorate.id)] ?? ""}
                onChange={(event) => setValues({ ...values, [String(governorate.id)]: event.target.value })}
              />
            </Field>
          ))}
        </div>
      </fieldset>

      <FormError error={error} />
      <Button type="submit" className="justify-self-start" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
