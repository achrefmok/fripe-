"use client";

import { useLocale, useTranslations } from "next-intl";
import type { FieldErrors, FieldValues, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { LocationOption } from "@/features/shops/queries";

type AddressValues = { governorateId: string; cityId: string; addressLine: string };

// Adresse de livraison facultative, partagée par l'inscription et le profil : elle préremplit la commande.
export function AddressFields<T extends FieldValues>({
  locations,
  governorateId,
  register,
  setValue,
  errors,
}: {
  locations: LocationOption[];
  governorateId: string;
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  errors: FieldErrors<T>;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const label = (option: { nameFr: string; nameAr: string }) => (locale === "ar" ? option.nameAr : option.nameFr);
  const cities = locations.find((location) => String(location.id) === String(governorateId))?.cities ?? [];
  const reg = register as unknown as UseFormRegister<AddressValues>;
  const set = setValue as unknown as UseFormSetValue<AddressValues>;
  const fieldErrors = errors as FieldErrors<AddressValues>;

  return (
    <fieldset className="grid gap-4">
      <legend className="mb-1 text-sm font-semibold">
        {t("addressTitle")} <span className="font-normal text-muted-foreground">· {t("addressOptional")}</span>
      </legend>
      <div className="grid grid-cols-2 gap-4">
        <Field id="governorateId" label={t("governorate")} error={fieldErrors.governorateId?.message}>
          <NativeSelect
            id="governorateId"
            autoComplete="address-level1"
            {...reg("governorateId", { onChange: () => set("cityId", "") })}
          >
            <option value="">{t("choose")}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {label(location)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="cityId" label={t("city")} error={fieldErrors.cityId?.message}>
          <NativeSelect id="cityId" autoComplete="address-level2" disabled={!cities.length} {...reg("cityId")}>
            <option value="">{t("choose")}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {label(city)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id="addressLine" label={t("addressLine")} error={fieldErrors.addressLine?.message}>
        <Input id="addressLine" autoComplete="street-address" maxLength={200} {...reg("addressLine")} />
      </Field>
    </fieldset>
  );
}
