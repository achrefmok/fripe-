"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setProductsPublication } from "@/features/catalog/actions";
import { useRouter } from "@/i18n/navigation";

export function ProductPublishButton({ shopId, productId }: { shopId: string; productId: string }) {
  const t = useTranslations("sellerShop");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <Button
        disabled={pending}
        className="justify-self-start"
        onClick={() =>
          startTransition(async () => {
            const result = await setProductsPublication(shopId, [productId], "published");

            if (!result.ok) {
              setProblem(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
            } else if (result.data.problems[0]) {
              setProblem(t(`problems.${result.data.problems[0].problem}`));
            } else {
              setProblem(null);
              toast.success(t("published", { count: 1 }));
              router.refresh();
            }
          })
        }
      >
        {t("publish")}
      </Button>
      {problem ? (
        <p role="alert" className="text-sm font-medium text-destructive">{problem}</p>
      ) : null}
    </div>
  );
}
