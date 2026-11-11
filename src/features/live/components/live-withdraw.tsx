"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { withdrawLive } from "../actions";

export function LiveWithdrawButton({ shopId, liveId, title }: { shopId: string; liveId: string; title: string }) {
  const t = useTranslations("live");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="studio__ghost"
      aria-label={`${t("withdraw")} : ${title}`}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("withdrawConfirm"))) return;
        startTransition(async () => {
          const result = await withdrawLive(shopId, liveId);
          if (result.ok) {
            toast.success(t("withdrawn"));
            router.refresh();
          } else {
            toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
          }
        });
      }}
    >
      <Trash2 className="size-4" aria-hidden="true" />
      {t("withdraw")}
    </button>
  );
}
