"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NoteDialog } from "@/features/admin/components/admin-actions";
import { reviewReport } from "@/features/moderation/actions";
import { useRouter } from "@/i18n/navigation";

type Decision = "dismiss" | "remove_content" | "suspend";

// Ce que chaque cible permet : une boutique ou un compte n'a pas de « contenu » à retirer,
// et une conversation n'a pas de coupable désigné.
const DECISIONS: Record<string, Decision[]> = {
  product: ["remove_content", "suspend", "dismiss"],
  video: ["remove_content", "suspend", "dismiss"],
  review: ["remove_content", "dismiss"],
  conversation: ["remove_content", "dismiss"],
  shop: ["suspend", "dismiss"],
  account: ["suspend", "dismiss"],
};

export function ReportActions({ reportId, targetType }: { reportId: string; targetType: string }) {
  const t = useTranslations("moderation");
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);

  const label = (value: Decision) =>
    value === "dismiss"
      ? t("dismiss")
      : value === "remove_content"
        ? t("removeContent")
        : targetType === "account"
          ? t("suspendAccount")
          : t("suspendShop");

  return (
    <div className="flex flex-wrap gap-2">
      {DECISIONS[targetType].map((value) => (
        <Button
          key={value}
          size="sm"
          variant={value === "dismiss" ? "outline" : "default"}
          onClick={() => setDecision(value)}
        >
          {label(value)}
        </Button>
      ))}
      <NoteDialog
        title={label(decision ?? "dismiss")}
        label={t("decisionNote")}
        open={decision !== null}
        onOpenChange={(open) => !open && setDecision(null)}
        onConfirm={async (note) => {
          const result = await reviewReport(reportId, decision ?? "dismiss", note);

          if (result.ok) {
            toast.success(t("decided"));
            router.refresh();
          }

          return result;
        }}
      />
    </div>
  );
}
