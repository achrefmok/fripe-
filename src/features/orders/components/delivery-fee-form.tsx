"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveDeliveryRates } from "@/features/orders/actions";
import type { LocationOption } from "@/features/shops/queries";

export function DeliveryRatesForm({
  shopId,
  governorates,
  defaultFee,
  overrides,
}: {
  shopId: string;
  governorates: LocationOption[];
  defaultFee: string;
  overrides: Record<string, string>;
}) {
  const t = useTranslations("sellerShop");
  const locale = useLocale();
  const [fee, setFee] = useState(defaultFee);
  const [rates, setRates] = useState(overrides);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setErrors({});

        startTransition(async () => {
          const result = await saveDeliveryRates(shopId, fee, rates);
          if (result.ok) toast.success(t("feeSaved"));
          else setErrors(result.fields ?? { fee: result.error });
        });
      }}
    >
      <Field id="fee" label={t("deliveryFee")} hint={t("deliveryFeeHint")} error={errors.fee}>
        <Input id="fee" inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} />
      </Field>

      <details className="border-y py-2">
        <summary className="cursor-pointer py-1 text-sm font-semibold">{t("deliveryByGovernorate")}</summary>
        <p className="py-1 text-sm text-muted-foreground">{t("deliveryByGovernorateHint")}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
          {governorates.map((governorate) => {
            const name = locale === "ar" ? governorate.nameAr : governorate.nameFr;
            const key = String(governorate.id);

            return (
              <Field key={key} id={`fee-${key}`} label={name} error={errors[key]}>
                <Input
                  id={`fee-${key}`}
                  inputMode="decimal"
                  className="h-10"
                  value={rates[key] ?? ""}
                  onChange={(event) => setRates({ ...rates, [key]: event.target.value })}
                />
              </Field>
            );
          })}
        </div>
      </details>

      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {t("saveDraft")}
      </Button>
    </form>
  );
}
