"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  addInventoryItem,
  deleteInventoryItem,
  updateInventoryItem,
} from "@/features/inventory/actions";
import { inventoryItemSchema } from "@/features/inventory/schemas";
import { useFormAction } from "@/hooks/use-form-action";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/utils/action-result";

export function AddStockForm({
  shopId,
  categories,
}: {
  shopId: string;
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations("sellerShop");
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: { categoryId: "", label: "", approxQuantity: "" },
  });

  const { submit, pending, error } = useFormAction(
    form,
    (values) => addInventoryItem(shopId, values),
    () => {
      toast.success(t("stockAdded"));
      form.reset();
      router.refresh();
    },
  );

  const { errors } = form.formState;

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Field id="stock-category" label={t("stockCategory")} error={errors.categoryId?.message}>
          <NativeSelect id="stock-category" {...form.register("categoryId")}>
            <option value="">{t("choose")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="stock-quantity" label={t("stockQuantity")} error={errors.approxQuantity?.message}>
          <Input id="stock-quantity" inputMode="numeric" {...form.register("approxQuantity")} />
        </Field>
        <Field id="stock-label" label={t("stockLabel")} error={errors.label?.message}>
          <Input id="stock-label" {...form.register("label")} />
        </Field>
      </div>
      <FormError error={error} />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {t("stockAdd")}
      </Button>
    </form>
  );
}

export function StockRow({
  shopId,
  id,
  name,
  quantity,
  visible,
  countedAt,
}: {
  shopId: string;
  id: string;
  name: string;
  quantity: number;
  visible: boolean;
  countedAt: string;
}) {
  const t = useTranslations("sellerShop");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [value, setValue] = useState(String(quantity));
  const [isVisible, setIsVisible] = useState(visible);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, message?: string) {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        if (message) toast.success(message);
        router.refresh();
      } else {
        toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
      }
    });
  }

  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-muted-foreground">{t("stockCounted", { date: countedAt })}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          aria-label={`${t("stockQuantity")} ${name}`}
          inputMode="numeric"
          className="h-10 w-28"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() => updateInventoryItem(shopId, id, { approxQuantity: Number(value) }), t("done"))
          }
        >
          {t("stockSave")}
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--harissa)]"
            checked={isVisible}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.checked;
              setIsVisible(next);
              run(() => updateInventoryItem(shopId, id, { isVisible: next }));
            }}
          />
          {t("stockVisible")}
        </label>
        <button
          type="button"
          disabled={pending}
          className="text-sm font-medium underline underline-offset-4"
          onClick={() => run(() => deleteInventoryItem(shopId, id))}
        >
          {t("stockDelete")}
        </button>
      </div>
    </li>
  );
}
