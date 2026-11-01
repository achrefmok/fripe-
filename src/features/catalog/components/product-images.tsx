"use client";

import { ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { deleteProductImage, uploadProductImage } from "@/features/catalog/actions";
import { useRouter } from "@/i18n/navigation";
import { compressImage } from "@/lib/utils/compress-image";
import { productImageUrl } from "@/lib/utils/storage";

export function ProductImages({
  shopId,
  productId,
  images,
}: {
  shopId: string;
  productId: string;
  images: { id: string; path: string }[];
}) {
  const t = useTranslations("sellerShop");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(files: FileList | null) {
    if (!files?.length) return;

    const list = [...files];
    setError(null);

    startTransition(async () => {
      for (const [index, file] of list.entries()) {
        setProgress({ done: index + 1, total: list.length });

        const formData = new FormData();
        formData.set("image", await compressImage(file));

        const result = await uploadProductImage(shopId, productId, formData);
        if (!result.ok) {
          setError(result.error);
          break;
        }
      }

      setProgress(null);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <p className="text-[0.8rem] font-semibold">{t("photos")}</p>
      <ul className="flex flex-wrap gap-2">
        {images.map((image) => (
          <li key={image.id} className="relative size-24 overflow-hidden bg-secondary">
            <Image src={productImageUrl(image.path)} alt="" fill unoptimized sizes="96px" className="object-cover" />
            <button
              type="button"
              aria-label={t("deletePhoto")}
              disabled={pending}
              className="absolute end-0 top-0 flex size-7 items-center justify-center bg-foreground text-background"
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteProductImage(shopId, image.id);
                  if (result.ok) router.refresh();
                  else setError(result.error);
                })
              }
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={t("addPhotos")}
        onChange={(event) => upload(event.target.files)}
      />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
          <ImagePlus />
          {t("addPhotos")}
        </Button>
        {progress ? (
          <span role="status" className="text-sm text-muted-foreground">
            {t("uploading", progress)}
          </span>
        ) : null}
      </div>
      <p className="text-[0.8rem] text-muted-foreground">{t("photosHint")}</p>
      <FormError error={error} />
    </div>
  );
}
