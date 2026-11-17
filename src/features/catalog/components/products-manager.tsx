"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  bulkUpdateProducts,
  saveDraftRow,
  setProductAvailability,
  setProductsPublication,
} from "@/features/catalog/actions";
import { CONDITIONS } from "@/features/catalog/constants";
import { Link, useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/utils/action-result";
import { formatPrice, millimesToInput } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

type ProductRow = {
  id: string;
  title: string | null;
  reference: string;
  price_millimes: number | null;
  size: string | null;
  status: "available" | "reserved" | "sold";
  moderated_at: string | null;
  product_images: { path: string }[];
};

function DraftFields({ shopId, product }: { shopId: string; product: ProductRow }) {
  const t = useTranslations("sellerShop");
  const validation = useTranslations("validation");
  const [title, setTitle] = useState(product.title ?? "");
  const [price, setPrice] = useState(millimesToInput(product.price_millimes));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const result = await saveDraftRow(shopId, product.id, { title, price });
    const message = result.ok ? null : (Object.values(result.fields ?? {})[0] ?? result.error);
    setError(message);
  }

  return (
    <div className="grid flex-1 grid-cols-[1fr_5.5rem] gap-3">
      <Input
        aria-label={`${t("formTitle")} ${product.reference}`}
        value={title}
        className="h-10"
        placeholder={t("untitled")}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={save}
      />
      <Input
        aria-label={`${t("formPrice")} ${product.reference}`}
        value={price}
        inputMode="decimal"
        className="h-10"
        placeholder={t("formPrice")}
        onChange={(event) => setPrice(event.target.value)}
        onBlur={save}
      />
      {error ? (
        <p role="alert" className="col-span-2 text-[0.8rem] font-medium text-destructive">
          {validation.has(error) ? validation(error) : error}
        </p>
      ) : null}
    </div>
  );
}

export function ProductsManager({
  shopId,
  tab,
  products,
  categories,
}: {
  shopId: string;
  tab: "draft" | "published" | "archived";
  products: ProductRow[];
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations("sellerShop");
  const status = useTranslations("product");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const router = useRouter();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [bulk, setBulk] = useState({ price: "", categoryId: "", condition: "" });
  const [pending, startTransition] = useTransition();

  const ids = [...selected];

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function run(action: () => Promise<ActionResult<unknown>>, message?: string) {
    setError(null);

    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        setError(Object.values(result.fields ?? {})[0] ?? result.error);
        return;
      }

      if (message) toast.success(message);
      router.refresh();
    });
  }

  function publication(target: "published" | "draft" | "archived") {
    setError(null);

    startTransition(async () => {
      const result = await setProductsPublication(shopId, ids, target);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const refused = Object.fromEntries(
        result.data.problems.map(({ id, problem }) => [id, problem]),
      );
      const done = ids.length - result.data.problems.length;

      setProblems(refused);
      setSelected(new Set(Object.keys(refused)));

      if (result.data.problems.length) {
        toast.warning(t("skipped", { count: result.data.problems.length }));
      } else if (target === "published") {
        toast.success(t("published", { count: done }));
      } else {
        toast.success(t("done"));
      }

      router.refresh();
    });
  }

  if (!products.length) {
    return <p className="border-y py-8 text-muted-foreground">{t("emptyProducts")}</p>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b pb-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-[var(--harissa)]"
            checked={selected.size === products.length}
            onChange={(event) =>
              setSelected(new Set(event.target.checked ? products.map((row) => row.id) : []))
            }
          />
          {t("selectAll")}
        </label>
        {selected.size ? (
          <span className="text-sm text-muted-foreground">{t("selected", { count: selected.size })}</span>
        ) : null}
      </div>

      {selected.size ? (
        <section className="sticky top-14 z-20 grid gap-3 border-b bg-background py-3">
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4">
            <div>
              <label htmlFor="bulk-price" className="text-[0.8rem] font-semibold">{t("applyPrice")}</label>
              <Input
                id="bulk-price"
                inputMode="decimal"
                className="h-10"
                value={bulk.price}
                onChange={(event) => setBulk({ ...bulk, price: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="bulk-category" className="text-[0.8rem] font-semibold">{t("applyCategory")}</label>
              <NativeSelect
                id="bulk-category"
                className="h-10"
                value={bulk.categoryId}
                onChange={(event) => setBulk({ ...bulk, categoryId: event.target.value })}
              >
                <option value="">{t("keep")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <label htmlFor="bulk-condition" className="text-[0.8rem] font-semibold">{t("applyCondition")}</label>
              <NativeSelect
                id="bulk-condition"
                className="h-10"
                value={bulk.condition}
                onChange={(event) => setBulk({ ...bulk, condition: event.target.value })}
              >
                <option value="">{t("keep")}</option>
                {CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>{conditions(condition)}</option>
                ))}
              </NativeSelect>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => bulkUpdateProducts(shopId, ids, bulk), t("applied"))}
            >
              {t("apply")}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tab !== "published" ? (
              <Button size="sm" disabled={pending} onClick={() => publication("published")}>
                {t("publish")}
              </Button>
            ) : null}
            {tab === "published" ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => publication("draft")}>
                {t("unpublish")}
              </Button>
            ) : null}
            {tab !== "archived" ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => publication("archived")}>
                {t("archive")}
              </Button>
            ) : null}
          </div>
          <FormError error={error} />
        </section>
      ) : null}

      <ul className="divide-y border-b">
        {products.map((product) => {
          const image = product.product_images[0];
          const problem = problems[product.id];

          return (
            <li key={product.id} className="flex items-center gap-3 py-3">
              <input
                type="checkbox"
                className="size-4 shrink-0 accent-[var(--harissa)]"
                aria-label={t("selectRow", { title: product.title ?? product.reference })}
                checked={selected.has(product.id)}
                onChange={() => toggle(product.id)}
              />
              <div className="relative size-14 shrink-0 overflow-hidden bg-secondary">
                {image ? (
                  <Image src={productImageUrl(image.path)} alt="" fill sizes="56px" className="object-cover" />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                {tab === "draft" ? (
                  <DraftFields shopId={shopId} product={product} />
                ) : (
                  <>
                    <p className="truncate font-semibold">{product.title ?? t("untitled")}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.price_millimes ? formatPrice(product.price_millimes, locale) : "—"}
                      {" · "}
                      {status(product.status)}
                      {product.moderated_at ? ` · ${t("moderated")}` : ""}
                    </p>
                  </>
                )}
                <p className="truncate text-xs text-muted-foreground" dir="ltr">{product.reference}</p>
                {problem ? (
                  <p role="alert" className="text-[0.8rem] font-medium text-destructive">
                    {t(`problems.${problem}`)}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1 text-sm font-medium">
                <Link
                  href={`/vendeur/boutique/${shopId}/produits/${product.id}`}
                  className="underline underline-offset-4"
                >
                  {t("edit")}
                </Link>
                {tab === "published" && product.status === "available" ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="underline underline-offset-4"
                    onClick={() => run(() => setProductAvailability(shopId, product.id, "sold"))}
                  >
                    {t("markSold")}
                  </button>
                ) : null}
                {tab === "published" && product.status === "sold" ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="underline underline-offset-4"
                    onClick={() => run(() => setProductAvailability(shopId, product.id, "available"))}
                  >
                    {t("markAvailable")}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
