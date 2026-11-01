"use client";

import { Images } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { createDraftFromPhoto } from "@/features/catalog/actions";
import { MAX_BULK_IMAGES } from "@/features/catalog/constants";
import { useRouter } from "@/i18n/navigation";
import { compressImage } from "@/lib/utils/compress-image";

export function PhotoBatch({ shopId }: { shopId: string }) {
  const t = useTranslations("sellerShop");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(files: FileList | null) {
    if (!files?.length) return;

    const list = [...files].slice(0, MAX_BULK_IMAGES);
    setError(null);

    startTransition(async () => {
      let created = 0;

      for (const [index, file] of list.entries()) {
        setProgress({ done: index + 1, total: list.length });

        const formData = new FormData();
        formData.set("image", await compressImage(file));

        const result = await createDraftFromPhoto(shopId, formData);
        if (!result.ok) {
          setError(result.error);
          break;
        }

        created += 1;
      }

      setProgress(null);
      if (input.current) input.current.value = "";

      if (created) {
        toast.success(t("quickDrafts", { count: created }));
        router.push(`/vendeur/boutique/${shopId}/produits?onglet=draft`);
      }
    });
  }

  return (
    <div className="grid gap-2">
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={t("quickPhotosButton")}
        onChange={(event) => upload(event.target.files)}
      />
      <div className="flex items-center gap-3">
        <Button type="button" disabled={pending} onClick={() => input.current?.click()}>
          <Images />
          {t("quickPhotosButton")}
        </Button>
        {progress ? (
          <span role="status" className="text-sm text-muted-foreground">
            {t("uploading", progress)}
          </span>
        ) : null}
      </div>
      <FormError error={error} />
    </div>
  );
}
