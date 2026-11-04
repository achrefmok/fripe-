"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createReport } from "@/features/moderation/actions";

const REASONS = ["counterfeit", "inappropriate", "scam", "harassment", "other"] as const;

export function ReportDialog({
  targetType,
  targetId,
  variant = "button",
  label,
}: {
  targetType: "product" | "video" | "conversation" | "shop" | "account" | "review" | "listing" | "listing_thread";
  targetId: string;
  variant?: "button" | "overlay";
  label?: string;
}) {
  const t = useTranslations("moderation");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("inappropriate");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {variant === "overlay" ? (
        <button
          type="button"
          aria-label={t("report")}
          onClick={() => setOpen(true)}
          className="flex size-11 items-center justify-center bg-black/50"
        >
          <Flag className="size-5" />
        </button>
      ) : (
        <Button variant="ghost" onClick={() => setOpen(true)}>
          <Flag />
          {label ?? t("report")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reportTitle")}</DialogTitle>
          </DialogHeader>
          <Field id="report-reason" label={t("reason")}>
            <NativeSelect
              id="report-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as (typeof REASONS)[number])}
            >
              {REASONS.map((value) => (
                <option key={value} value={value}>{t(`reasons.${value}`)}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="report-details" label={t("details")} optional>
            <Textarea
              id="report-details"
              maxLength={500}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
            />
          </Field>
          <FormError error={error} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{common("cancel")}</Button>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await createReport({ targetType, targetId, reason, details });

                  if (result.ok) {
                    toast.success(t("sent"));
                    setDetails("");
                    setOpen(false);
                  } else {
                    setError(result.error);
                  }
                })
              }
            >
              {t("send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
