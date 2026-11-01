"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
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
import { profileSchema } from "@/features/auth/schemas";
import { useFormAction } from "@/hooks/use-form-action";

type ProfileDefaults = { displayName: string; phone: string; locale: "fr" | "ar" };

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const t = useTranslations("account");
  const auth = useTranslations("auth");
  const common = useTranslations("common");

  const form = useForm({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const { submit, pending, error } = useFormAction(form, updateProfile, () =>
    toast.success(common("saved")),
  );
  const { errors } = form.formState;

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
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
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
