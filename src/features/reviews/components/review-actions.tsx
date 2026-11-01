"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteDialog } from "@/features/admin/components/admin-actions";
import { moderateReview, replyToReview } from "@/features/reviews/actions";
import { useRouter } from "@/i18n/navigation";

export function ReplyButton({ reviewId }: { reviewId: string }) {
  const t = useTranslations("reviews");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>{t("reply")}</Button>
      <NoteDialog
        title={t("reply")}
        label={t("replyLabel")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (reply) => {
          const result = await replyToReview({ reviewId, reply });

          if (result.ok) {
            toast.success(t("replied"));
            router.refresh();
          }

          return result;
        }}
      />
    </>
  );
}

export function ModerateReviewButton({ reviewId, status }: { reviewId: string; status: "published" | "hidden" }) {
  const t = useTranslations("reviews");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const next = status === "published" ? "hidden" : "published";
  const label = next === "hidden" ? t("hide") : t("restore");

  return (
    <>
      <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setOpen(true)}>{label}</Button>
      <NoteDialog
        title={label}
        label={t("moderationNote")}
        open={open}
        onOpenChange={setOpen}
        onConfirm={async (note) => {
          const result = await moderateReview({ reviewId, status: next, note });

          if (result.ok) {
            toast.success(t("moderated"));
            router.refresh();
          }

          return result;
        }}
      />
    </>
  );
}
