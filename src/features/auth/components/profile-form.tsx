"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile } from "@/features/auth/actions";
import { AddressFields } from "@/features/auth/components/address-fields";
import type { LocationOption } from "@/features/shops/queries";
import { profileSchema } from "@/features/auth/schemas";
import { useFormAction } from "@/hooks/use-form-action";

type ProfileDefaults = {
  displayName: string;
  phone: string;
  locale: "fr" | "ar";
  governorateId: string;
  cityId: string;
  addressLine: string;
};

export function ProfileForm({ defaults, locations }: { defaults: ProfileDefaults; locations: LocationOption[] }) {
  const t = useTranslations("account");
  const auth = useTranslations("auth");
  const common = useTranslations("common");

  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const { submit, pending, error } = useFormAction(form, updateProfile, () =>
    toast.success(common("saved")),
  );
  const { errors } = form.formState;
  const governorateId = String(useWatch({ control: form.control, name: "governorateId" }) ?? "");

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Field id="displayName" label={auth("displayName")} error={errors.displayName?.message}>
        <Input
          id="displayName"
          autoComplete="name"
          aria-invalid={Boolean(errors.displayName)}
          {...form.register("displayName")}
        />
      </Field>
      <Field
        id="phone"
        label={t("phone")}
        optional
        hint={t("phoneHint")}
        error={errors.phone?.message}
      >
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel-national"
          aria-invalid={Boolean(errors.phone)}
          className="text-start"
          {...form.register("phone")}
        />
      </Field>
      <AddressFields
        locations={locations}
        governorateId={governorateId}
        register={form.register}
        setValue={form.setValue}
        errors={errors}
      />
      <Field id="locale" label={t("locale")}>
        <Controller
          control={form.control}
          name="locale"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr"><span lang="fr" dir="ltr">Français</span></SelectItem>
                <SelectItem value="ar"><span lang="ar" dir="rtl">العربية</span></SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {common("save")}
      </Button>
    </form>
  );
}
