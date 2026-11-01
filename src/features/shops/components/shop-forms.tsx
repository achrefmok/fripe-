"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { createShop, updateShop } from "@/features/shops/actions";
import type { LocationOption } from "@/features/shops/queries";
import { createShopSchema, updateShopSchema } from "@/features/shops/schemas";
import { useFormAction } from "@/hooks/use-form-action";
import { useRouter } from "@/i18n/navigation";
import { slugify } from "@/lib/utils/slug";

type ShopValues = {
  name: string;
  description: string;
  phone: string;
  governorateId: string;
  cityId: string;
};

function SharedFields({
  control,
  register,
  setValue,
  errors,
  locations,
  governorateId,
}: {
  control: Control<ShopValues>;
  register: UseFormRegister<ShopValues>;
  setValue: UseFormSetValue<ShopValues>;
  errors: FieldErrors<ShopValues>;
  locations: LocationOption[];
  governorateId: string;
}) {
  const t = useTranslations("seller");
  const locale = useLocale();
  const label = (item: { nameFr: string; nameAr: string }) =>
    locale === "ar" ? item.nameAr : item.nameFr;
  const cities = locations.find((item) => String(item.id) === governorateId)?.cities ?? [];

  return (
    <>
      <Field
        id="description"
        label={t("description")}
        optional
        hint={t("descriptionHint")}
        error={errors.description?.message}
      >
        <Textarea id="description" maxLength={1000} {...register("description")} />
      </Field>
      <Field id="phone" label={t("phone")} optional error={errors.phone?.message}>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          dir="ltr"
          autoComplete="tel-national"
          aria-invalid={Boolean(errors.phone)}
          className="text-start"
          {...register("phone")}
        />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="governorateId" label={t("governorate")} error={errors.governorateId?.message}>
          <Controller
            control={control}
            name="governorateId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  setValue("cityId", "");
                }}
              >
                <SelectTrigger id="governorateId" aria-invalid={Boolean(errors.governorateId)}>
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {label(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field id="cityId" label={t("city")} error={errors.cityId?.message}>
          <Controller
            control={control}
            name="cityId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!cities.length}>
                <SelectTrigger id="cityId" aria-invalid={Boolean(errors.cityId)}>
                  <SelectValue placeholder={t("selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {label(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </div>
    </>
  );
}

export function CreateShopForm({ locations }: { locations: LocationOption[] }) {
  const t = useTranslations("seller");
  const router = useRouter();
  const [slugEdited, setSlugEdited] = useState(false);

  const form = useForm({
    resolver: zodResolver(createShopSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      phone: "",
      governorateId: "",
      cityId: "",
    },
  });

  const { submit, pending, error } = useFormAction(form, createShop, ({ shopId }) => {
    toast.success(t("created"));
    router.push(`/vendeur/boutique/${shopId}`);
  });

  const { errors } = form.formState;
  const slug = useWatch({ control: form.control, name: "slug" });
  const governorateId = String(useWatch({ control: form.control, name: "governorateId" }));

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Field id="name" label={t("name")} error={errors.name?.message}>
        <Input
          id="name"
          aria-invalid={Boolean(errors.name)}
          {...form.register("name", {
            onChange: (event) => {
              if (!slugEdited) {
                form.setValue("slug", slugify(event.target.value));
              }
            },
          })}
        />
      </Field>
      <Field
        id="slug"
        label={t("slug")}
        hint={<span dir="ltr">{t("slugHint", { slug: slug || "…" })}</span>}
        error={errors.slug?.message}
      >
        <Input
          id="slug"
          dir="ltr"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(errors.slug)}
          className="text-start"
          {...form.register("slug", {
            onChange: () => setSlugEdited(true),
          })}
        />
      </Field>
      <SharedFields
        control={form.control as unknown as Control<ShopValues>}
        register={form.register as unknown as UseFormRegister<ShopValues>}
        setValue={form.setValue as unknown as UseFormSetValue<ShopValues>}
        errors={errors as FieldErrors<ShopValues>}
        locations={locations}
        governorateId={governorateId}
      />
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:justify-self-start">
        {t("createSubmit")}
      </Button>
    </form>
  );
}

export function EditShopForm({
  shopId,
  locations,
  defaults,
}: {
  shopId: string;
  locations: LocationOption[];
  defaults: ShopValues;
}) {
  const t = useTranslations("seller");
  const common = useTranslations("common");
  const router = useRouter();

  const form = useForm({ resolver: zodResolver(updateShopSchema), defaultValues: defaults });

  const { submit, pending, error } = useFormAction(
    form,
    (values) => updateShop(shopId, values),
    () => {
      toast.success(common("saved"));
      router.refresh();
    },
  );

  const { errors } = form.formState;
  const governorateId = String(useWatch({ control: form.control, name: "governorateId" }));

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Field id="name" label={t("name")} error={errors.name?.message}>
        <Input id="name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
      </Field>
      <SharedFields
        control={form.control as unknown as Control<ShopValues>}
        register={form.register as unknown as UseFormRegister<ShopValues>}
        setValue={form.setValue as unknown as UseFormSetValue<ShopValues>}
        errors={errors as FieldErrors<ShopValues>}
        locations={locations}
        governorateId={governorateId}
      />
      <FormError error={error} />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {common("save")}
      </Button>
    </form>
  );
}
