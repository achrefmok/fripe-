"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/features/auth/actions";

export function DeleteAccount() {
  const t = useTranslations("account");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="mt-12 grid max-w-xl gap-2 border-t pt-6">
      <h2 className="font-display text-xl font-bold">{t("deleteTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("deleteHint")}</p>
      <Button variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>
        {t("deleteOpen")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
          </DialogHeader>
          <ul className="grid list-disc gap-1 ps-5 text-sm">
            <li>{t("deleteRemoved")}</li>
            <li>{t("deleteKept")}</li>
            <li>{t("deleteShops")}</li>
            <li>{t("deleteFinal")}</li>
          </ul>
          <Field id="delete-password" label={t("deletePassword")}>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--harissa)]"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {t("deleteConfirm")}
          </label>
          <FormError error={error} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{common("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={pending || !confirmed || !password}
              onClick={() =>
                startTransition(async () => {
                  setError(null);

                  const result = await deleteAccount({ password, confirmation: confirmed });
                  if (!result.ok) setError(result.error);
                })
              }
            >
              {t("deleteSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
