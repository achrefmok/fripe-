"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createCollection,
  deleteCollection,
  updateCollection,
} from "@/features/collections/actions";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/utils/action-result";

type Values = { name: string; description: string; isPublished: boolean };

function useCollectionForm(defaults: Values) {
  const [values, setValues] = useState(defaults);
  const [nameError, setNameError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run<T>(action: () => Promise<ActionResult<T>>, onDone: (data: T) => void) {
    setNameError(undefined);
    setError(null);

    startTransition(async () => {
      const result = await action();

      if (result.ok) onDone(result.data);
      else if (result.fields?.name) setNameError(result.fields.name);
      else setError(result.error);
    });
  }

  return { values, setValues, nameError, error, pending, run };
}

function SharedFields({
  values,
  setValues,
  nameError,
}: {
  values: Values;
  setValues: (values: Values) => void;
  nameError?: string;
}) {
  const t = useTranslations("sellerShop");

  return (
    <>
      <Field id="collection-name" label={t("collectionName")} error={nameError}>
        <Input
          id="collection-name"
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
      </Field>
      <Field id="collection-description" label={t("collectionDescription")}>
        <Textarea
          id="collection-description"
          maxLength={500}
          value={values.description}
          onChange={(event) => setValues({ ...values, description: event.target.value })}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 accent-[var(--harissa)]"
          checked={values.isPublished}
          onChange={(event) => setValues({ ...values, isPublished: event.target.checked })}
        />
        {t("collectionPublished")}
      </label>
    </>
  );
}

export function CreateCollectionForm({ shopId }: { shopId: string }) {
  const t = useTranslations("sellerShop");
  const router = useRouter();
  const form = useCollectionForm({ name: "", description: "", isPublished: true });

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.run(
          () => createCollection(shopId, form.values),
          ({ collectionId }) => {
            toast.success(t("collectionCreated"));
            router.push(`/vendeur/boutique/${shopId}/collections/${collectionId}`);
          },
        );
      }}
    >
      <SharedFields values={form.values} setValues={form.setValues} nameError={form.nameError} />
      <FormError error={form.error} />
      <Button type="submit" disabled={form.pending} className="justify-self-start">
        {t("collectionCreate")}
      </Button>
    </form>
  );
}

export function EditCollectionForm({
  shopId,
  collectionId,
  defaults,
  selectedIds,
  candidates,
}: {
  shopId: string;
  collectionId: string;
  defaults: Values;
  selectedIds: string[];
  candidates: { id: string; title: string | null; reference: string }[];
}) {
  const t = useTranslations("sellerShop");
  const router = useRouter();
  const form = useCollectionForm(defaults);
  const [selected, setSelected] = useState(new Set(selectedIds));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <form
      noValidate
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.run(
          () => updateCollection(shopId, collectionId, form.values, [...selected]),
          () => {
            toast.success(t("done"));
            router.refresh();
          },
        );
      }}
    >
      <SharedFields values={form.values} setValues={form.setValues} nameError={form.nameError} />

      <fieldset>
        <legend className="text-[0.8rem] font-semibold">{t("collectionPieces")}</legend>
        {candidates.length ? (
          <ul className="mt-2 max-h-80 divide-y overflow-y-auto border-y">
            {candidates.map((product) => (
              <li key={product.id}>
                <label className="flex items-center gap-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--harissa)]"
                    checked={selected.has(product.id)}
                    onChange={() => toggle(product.id)}
                  />
                  <span className="flex-1 truncate">{product.title ?? t("untitled")}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">{product.reference}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("collectionNoCandidates")}</p>
        )}
      </fieldset>

      <FormError error={form.error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={form.pending}>{t("saveDraft")}</Button>
        <Button
          type="button"
          variant="ghost"
          disabled={form.pending}
          onClick={() =>
            form.run(
              () => deleteCollection(shopId, collectionId),
              () => {
                toast.success(t("collectionDeleted"));
                router.push(`/vendeur/boutique/${shopId}/collections`);
              },
            )
          }
        >
          {t("collectionDelete")}
        </Button>
      </div>
    </form>
  );
}
