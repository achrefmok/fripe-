"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { listingImageUrl, productImageUrl } from "@/lib/utils/storage";

// Partagée avec les annonces de particuliers, dont les photos vivent dans leur propre bucket.
export function ProductGallery({
  images,
  title,
  bucket = "product",
}: {
  images: { id: string; path: string }[];
  title: string;
  bucket?: "product" | "listing";
}) {
  const imageUrl = bucket === "listing" ? listingImageUrl : productImageUrl;
  const t = useTranslations("product");
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[24px] bg-secondary">
        {current ? (
          <Image
            src={imageUrl(current.path)}
            alt={t("photoAlt", { number: active + 1, title })}
            fill
            unoptimized
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-muted-foreground">
            {t("noPhoto")}
          </span>
        )}
      </div>
      {images.length > 1 ? (
        <div className="rail-scroll mt-2.5 flex justify-center gap-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={t("photoAlt", { number: index + 1, title })}
              aria-current={index === active}
              onClick={() => setActive(index)}
              className={cn(
                "relative aspect-[4/5] w-[62px] shrink-0 overflow-hidden rounded-xl border-[1.5px]",
                index === active ? "border-gold" : "border-transparent",
              )}
            >
              <Image src={imageUrl(image.path)} alt="" fill unoptimized sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
