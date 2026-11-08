"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteDialog } from "@/features/admin/components/admin-actions";
import { reviewArrival } from "@/features/arrivals/actions";
import { useRouter } from "@/i18n/navigation";

// Valider met l'arrivage en tête de l'accueil ; refuser demande un motif, que la boutique lit.
export function ArrivalReviewActions({ arrivalId, title }: { arrivalId: string; title: string }) {
  const t = useTranslations("arrivals");
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        disabled={pending}
        aria-label={t("approveLabel", { title })}
        onClick={() =>
          startTransition(async () => {
            const result = await reviewArrival(arrivalId, "approved", "");
            if (result.ok) {
              toast.success(t("approved"));
              router.refresh();
            } else toast.error(t("reviewFailed"));
          })
        }
      >
        {t("approve")}
      </Button>
      <Button type="button" variant="outline" disabled={pending} aria-label={t("rejectLabel", { title })} onClick={() => setRejecting(true)}>
        {t("reject")}
      </Button>
      <NoteDialog
        title={t("rejectTitle")}
        label={t("rejectReason")}
        open={rejecting}
        onOpenChange={setRejecting}
        onConfirm={async (note) => {
          const result = await reviewArrival(arrivalId, "rejected", note);
          if (result.ok) {
            toast.success(t("rejected"));
            router.refresh();
          }
          return result;
        }}
      />
    </div>
  );
}
