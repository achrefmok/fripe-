"use client";

import { Camera, ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export const MAX_PRODUCT_PHOTOS = 8;

export type PickedPhoto = { id: string; file: File; url: string };

// Photos choisies avant la création du produit : gardées dans le navigateur,
// envoyées dans l'ordre affiché juste après l'enregistrement (la première sert de couverture).
export function PhotoPicker({
  photos,
  onChange,
  disabled = false,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("sellerShop");
  const p = useTranslations("productForm");
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const full = photos.length >= MAX_PRODUCT_PHOTOS;

  // Libère les aperçus quand le formulaire disparaît.
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);
  useEffect(() => () => latest.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  function add(files: FileList | null, input: HTMLInputElement | null) {
    if (!files?.length) return;
    const room = MAX_PRODUCT_PHOTOS - photos.length;
    const next = [...files]
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, room)
      .map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    onChange([...photos, ...next]);
    if (input) input.value = "";
  }

  function remove(id: string) {
    const photo = photos.find((entry) => entry.id === id);
    if (photo) URL.revokeObjectURL(photo.url);
    onChange(photos.filter((entry) => entry.id !== id));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      {photos.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative aspect-square overflow-hidden rounded-xl bg-secondary">
              {/* Aperçu local (blob:) : next/image n'apporte rien ici. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="size-full object-cover" />
              {index === 0 ? (
                <span className="absolute inset-s-1.5 top-1.5 rounded-full bg-foreground px-2 py-0.5 text-[0.65rem] font-semibold text-background">
                  {p("cover")}
                </span>
              ) : null}
              <button
                type="button"
                aria-label={t("deletePhoto")}
                disabled={disabled}
                className="absolute inset-e-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-foreground/85 text-background"
                onClick={() => remove(photo.id)}
              >
                <X className="size-4" />
              </button>
              {photos.length > 1 ? (
                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                  <button
                    type="button"
                    aria-label={p("photoEarlier")}
                    disabled={disabled || index === 0}
                    className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground disabled:invisible"
                    onClick={() => move(index, -1)}
                  >
                    <ChevronLeft className="size-4 rtl:rotate-180" />
                  </button>
                  <button
                    type="button"
                    aria-label={p("photoLater")}
                    disabled={disabled || index === photos.length - 1}
                    className="flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground disabled:invisible"
                    onClick={() => move(index, 1)}
                  >
                    <ChevronRight className="size-4 rtl:rotate-180" />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid place-items-center gap-1 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <ImagePlus className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-semibold">{p("photosEmpty")}</p>
          <p className="text-xs text-muted-foreground">{p("photosTip")}</p>
        </div>
      )}

      <input
        ref={gallery}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => add(event.target.files, event.target)}
      />
      <input
        ref={camera}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => add(event.target.files, event.target)}
      />

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button type="button" variant="outline" disabled={disabled || full} onClick={() => camera.current?.click()}>
          <Camera />
          {p("takePhoto")}
        </Button>
        <Button type="button" variant="outline" disabled={disabled || full} onClick={() => gallery.current?.click()}>
          <ImagePlus />
          {p("fromGallery")}
        </Button>
      </div>
      <p className="text-[0.8rem] text-muted-foreground">
        {p("photosCount", { count: photos.length, max: MAX_PRODUCT_PHOTOS })} · {p("photosOrder")}
      </p>
    </div>
  );
}
