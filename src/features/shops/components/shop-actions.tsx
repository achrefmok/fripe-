"use client";

import { ImageUp, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { resubmitShop, uploadShopLogo } from "@/features/shops/actions";
import { useRouter } from "@/i18n/navigation";

export function ResubmitButton({ shopId }: { shopId: string }) {
  const t = useTranslations("seller");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <FormError error={error} />
      <Button
        disabled={pending}
        className="justify-self-start"
        onClick={() =>
          startTransition(async () => {
            const result = await resubmitShop(shopId);
            if (result.ok) {
              toast.success(t("resubmitted"));
              router.refresh();
            } else {
              setError(result.error);
            }
          })
        }
      >
        {t("resubmit")}
      </Button>
    </div>
  );
}

export function LogoUploader({
  shopId,
  shopName,
  logoUrl,
}: {
  shopId: string;
  shopName: string;
  logoUrl: string | null;
}) {
  const t = useTranslations("seller");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function upload(file: File | undefined) {
    if (!file) return;

    const formData = new FormData();
    formData.set("logo", file);
    setError(null);

    startTransition(async () => {
      const result = await uploadShopLogo(shopId, formData);
      if (result.ok) {
        toast.success(t("logoSaved"));
        router.refresh();
      } else {
        setError(result.error);
      }
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="grid gap-2">
      <p className="text-[0.8rem] font-semibold">{t("logo")}</p>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden bg-secondary">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={t("logoAlt", { name: shopName })}
              width={80}
              height={80}
              className="size-full object-cover"
            />
          ) : (
            <Store className="size-7 text-muted-foreground" />
          )}
        </div>
        <div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={t("logoChoose")}
            onChange={(event) => upload(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            <ImageUp />
            {t("logoChoose")}
          </Button>
          <p className="mt-1 text-[0.8rem] text-muted-foreground">{t("logoHint")}</p>
        </div>
      </div>
      <FormError error={error} />
    </div>
  );
}
