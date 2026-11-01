"use client";

import { Ban } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setClientBlocked, setShopBlocked } from "@/features/messaging/actions";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/utils/action-result";

function BlockButton({
  blocked,
  blockLabel,
  run,
}: {
  blocked: boolean;
  blockLabel: string;
  run: () => Promise<ActionResult>;
}) {
  const t = useTranslations("messaging");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await run();

          if (result.ok) router.refresh();
          else toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
        })
      }
    >
      <Ban />
      {blocked ? t("unblock") : blockLabel}
    </Button>
  );
}

export function BlockShopButton({ shopId, blocked }: { shopId: string; blocked: boolean }) {
  const t = useTranslations("messaging");

  return (
    <BlockButton
      blocked={blocked}
      blockLabel={t("blockShop")}
      run={() => setShopBlocked(shopId, !blocked)}
    />
  );
}

export function BlockClientButton({
  shopId,
  clientId,
  blocked,
}: {
  shopId: string;
  clientId: string;
  blocked: boolean;
}) {
  const t = useTranslations("messaging");

  return (
    <BlockButton
      blocked={blocked}
      blockLabel={t("blockClient")}
      run={() => setClientBlocked(shopId, clientId, !blocked)}
    />
  );
}
