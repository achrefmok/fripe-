"use client";

import { ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { useRouter } from "@/i18n/navigation";
import { compressImage } from "@/lib/utils/compress-image";
import { listingImageUrl } from "@/lib/utils/storage";
import { deleteListingImage, uploadListingImage } from "../actions";
import { MAX_LISTING_IMAGES } from "../schemas";

// Les photos sont réduites dans le navigateur avant l'envoi : rapide sur une connexion mobile.
export function ListingPhotos({
  listingId,
  images,
  disabled,
}: {
  listingId: string;
  images: { id: string; path: string }[];
  disabled?: boolean;
}) {
  const t = useTranslations("market");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const room = MAX_LISTING_IMAGES - images.length;

  function upload(files: FileList | null) {
    if (!files?.length) return;

    const list = [...files].slice(0, Math.max(room, 0));
    setError(list.length < files.length ? "too_many_images" : null);

    startTransition(async () => {
      for (const [index, file] of list.entries()) {
        setProgress({ done: index + 1, total: list.length });

        const formData = new FormData();
        formData.set("image", await compressImage(file));

        const result = await uploadListingImage(listingId, formData);
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
    <section className="grid gap-3" aria-labelledby="photos-title">
      <h2 id="photos-title" className="font-display text-xl font-extrabold">
        {t("photosTitle")}
      </h2>
      {images.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {images.map((image, index) => (
            <li key={image.id} className="relative aspect-[3/4] overflow-hidden bg-secondary">
              <Image src={listingImageUrl(image.path)} alt="" fill sizes="160px" className="object-cover" />
              {index === 0 ? <span className="status-tag absolute bottom-1.5 start-1.5 bg-paper text-[oklch(0.2_0.014_55)]">1</span> : null}
              <button
                type="button"
                aria-label={t("deletePhoto")}
                disabled={pending || disabled}
                className="absolute end-0 top-0 flex size-9 items-center justify-center bg-foreground text-background"
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteListingImage(image.id);
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
      ) : (
        <p className="bg-secondary px-3 py-2 text-sm font-medium">{t("photosEmpty")}</p>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={t("addPhotos")}
        onChange={(event) => upload(event.target.files)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="h-11 gap-2" disabled={pending || disabled || room <= 0} onClick={() => input.current?.click()}>
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
    </section>
  );
}
