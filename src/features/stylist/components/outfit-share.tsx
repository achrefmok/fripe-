"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addItemsToCart, deleteOutfit } from "@/features/stylist/actions";
import { useRouter } from "@/i18n/navigation";

export function OutfitShare({ title }: { title: string }) {
  const t = useTranslations("outfits");

  return (
    <Button
      variant="outline"
      onClick={() => {
        const url = window.location.href;

        if (navigator.share) {
          navigator.share({ title, url }).catch(() => undefined);
        } else {
          navigator.clipboard.writeText(url).then(() => toast.success(t("linkCopied")));
        }
      }}
    >
      <Share2 />
      {t("share")}
    </Button>
  );
}

export function OutfitViewActions({
  outfitId,
  productIds,
  owner,
  signedIn,
}: {
  outfitId: string;
  productIds: string[];
  owner: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations("outfits");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {productIds.length ? (
        <Button
          disabled={pending}
          onClick={() => {
            if (!signedIn) {
              router.push({ pathname: "/connexion", query: { next: `/tenues/${outfitId}` } });
              return;
            }

            startTransition(async () => {
              const result = await addItemsToCart(productIds);
              if (result.ok) toast.success(t("addedToCart"));
            });
          }}
        >
          {t("addToCart")}
        </Button>
      ) : null}
      {owner ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteOutfit(outfitId);
              if (result.ok) router.push("/tenues");
            })
          }
        >
          {t("delete")}
        </Button>
      ) : null}
    </div>
  );
}
