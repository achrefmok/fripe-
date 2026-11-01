"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createStockRequest } from "@/features/inventory/actions";
import { stockRequestSchema } from "@/features/inventory/schemas";
import { useFormAction } from "@/hooks/use-form-action";
import { useRouter } from "@/i18n/navigation";

export function StockRequestForm({
  shopId,
  categories,
}: {
  shopId: string;
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations("requests");
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(stockRequestSchema),
    defaultValues: { categoryId: "", size: "", color: "", brand: "", budget: "", message: "" },
  });

  const { submit, pending, error } = useFormAction(
    form,
    (values) => createStockRequest(shopId, values),
    () => {
      toast.success(t("sent"));
      router.push("/compte/demandes");
    },
  );

  const { errors } = form.formState;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Field id="categoryId" label={t("category")}>
          <NativeSelect id="categoryId" {...form.register("categoryId")}>
            <option value="">{t("any")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="size" label={t("size")} error={errors.size?.message}>
          <Input id="size" {...form.register("size")} />
        </Field>
        <Field id="color" label={t("color")} error={errors.color?.message}>
          <Input id="color" {...form.register("color")} />
        </Field>
        <Field id="brand" label={t("brand")} error={errors.brand?.message}>
          <Input id="brand" {...form.register("brand")} />
        </Field>
      </div>
      <Field id="budget" label={t("budget")} error={errors.budget?.message}>
        <Input id="budget" inputMode="decimal" {...form.register("budget")} />
      </Field>
      <Field id="message" label={t("message")} error={errors.message?.message}>
        <Textarea
          id="message"
          maxLength={500}
          placeholder={t("messagePlaceholder")}
          aria-invalid={Boolean(errors.message)}
          {...form.register("message")}
        />
      </Field>
      <FormError error={error} />
      <Button type="submit" size="lg" disabled={pending}>{t("send")}</Button>
    </form>
  );
}
