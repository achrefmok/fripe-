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
import { createProduct, updateProduct } from "@/features/catalog/actions";
import { CONDITIONS } from "@/features/catalog/constants";
import { productSchema } from "@/features/catalog/schemas";
import { useFormAction } from "@/hooks/use-form-action";
import { useRouter } from "@/i18n/navigation";

type ProductValues = {
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
};

export function ProductForm({
  shopId,
  productId,
  categories,
  defaults = EMPTY,
}: {
  shopId: string;
  productId?: string;
  categories: { id: string; name: string }[];
  defaults?: ProductValues;
}) {
  const t = useTranslations("sellerShop");
  const conditions = useTranslations("conditions");
  const router = useRouter();

  const form = useForm<ProductValues, unknown, unknown>({
    resolver: zodResolver(productSchema) as never,
    defaultValues: defaults,
  });

  const { submit, pending, error } = useFormAction(
    form,
    async (values) => {
      if (productId) return updateProduct(shopId, productId, values);

      const result = await createProduct(shopId, values);
      if (result.ok) router.push(`/vendeur/boutique/${shopId}/produits/${result.data.productId}`);
      return result.ok ? { ok: true, data: undefined } : result;
    },
    () => {
      toast.success(t("done"));
      router.refresh();
    },
  );

  const { errors } = form.formState;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <Field id="title" label={t("formTitle")} error={errors.title?.message}>
        <Input id="title" aria-invalid={Boolean(errors.title)} {...form.register("title")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="categoryId" label={t("formCategory")}>
          <NativeSelect id="categoryId" {...form.register("categoryId")}>
            <option value="">{t("choose")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="condition" label={t("formCondition")}>
          <NativeSelect id="condition" {...form.register("condition")}>
            <option value="">{t("choose")}</option>
            {CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>{conditions(condition)}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="price" label={t("formPrice")} error={errors.price?.message}>
          <Input id="price" inputMode="decimal" aria-invalid={Boolean(errors.price)} {...form.register("price")} />
        </Field>
        <Field id="size" label={t("formSize")} error={errors.size?.message}>
          <Input id="size" {...form.register("size")} />
        </Field>
        <Field id="brand" label={t("formBrand")} error={errors.brand?.message}>
          <Input id="brand" {...form.register("brand")} />
        </Field>
        <Field id="color" label={t("formColor")} error={errors.color?.message}>
          <Input id="color" {...form.register("color")} />
        </Field>
      </div>
      <Field
        id="reference"
        label={t("formReference")}
        hint={t("formReferenceHint")}
        error={errors.reference?.message}
      >
        <Input id="reference" dir="ltr" className="text-start" {...form.register("reference")} />
      </Field>
      <Field id="description" label={t("formDescription")} error={errors.description?.message}>
        <Textarea id="description" maxLength={2000} {...form.register("description")} />
      </Field>
      <Field
        id="defects"
        label={t("formDefects")}
        hint={t("formDefectsHint")}
        error={errors.defects?.message}
      >
        <Textarea id="defects" maxLength={500} {...form.register("defects")} />
      </Field>
      <FormError error={error} />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {t("saveDraft")}
      </Button>
    </form>
  );
}
