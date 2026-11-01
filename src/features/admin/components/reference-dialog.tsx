"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/utils/action-result";

type Values = { nameFr: string; nameAr: string; position?: number };

// Même saisie pour une catégorie, un gouvernorat ou une délégation : un nom dans chaque langue.
export function ReferenceDialog({
  trigger,
  title,
  initial,
  withPosition,
  variant = "outline",
  onSave,
}: {
  trigger: string;
  title: string;
  initial?: Values;
  withPosition?: boolean;
  variant?: "outline" | "default" | "ghost";
  onSave: (values: Values) => Promise<ActionResult>;
}) {
  const t = useTranslations("adminReference");
  const common = useTranslations("common");
  const admin = useTranslations("admin");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nameFr, setNameFr] = useState(initial?.nameFr ?? "");
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? "");
  const [position, setPosition] = useState(String(initial?.position ?? 0));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>{trigger}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <Field id="ref-fr" label={t("nameFr")} error={fields.nameFr}>
            <Input id="ref-fr" dir="ltr" value={nameFr} onChange={(event) => setNameFr(event.target.value)} />
          </Field>
          <Field id="ref-ar" label={t("nameAr")} error={fields.nameAr}>
            <Input id="ref-ar" dir="rtl" value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
          </Field>
          {withPosition ? (
            <Field id="ref-position" label={t("position")} error={fields.position}>
              <Input id="ref-position" type="number" inputMode="numeric" min={0} value={position} onChange={(event) => setPosition(event.target.value)} />
            </Field>
          ) : null}
          <FormError error={error} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{common("cancel")}</Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  setFields({});

                  const result = await onSave({ nameFr, nameAr, position: Number(position) });

                  if (result.ok) {
                    toast.success(admin("actionDone"));
                    setOpen(false);
                    router.refresh();
                  } else if (result.fields && Object.keys(result.fields).length) {
                    setFields(result.fields);
                  } else {
                    setError(result.error);
                  }
                })
              }
            >
              {admin("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReferenceAction({
  label,
  run,
  variant = "ghost",
}: {
  label: string;
  run: () => Promise<ActionResult>;
  variant?: "ghost" | "outline";
}) {
  const errors = useTranslations("errors");
  const admin = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await run();

          if (result.ok) {
            toast.success(admin("actionDone"));
            router.refresh();
          } else {
            toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
          }
        })
      }
    >
      {label}
    </Button>
  );
}
