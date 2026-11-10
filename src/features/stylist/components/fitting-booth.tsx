"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { productImageUrl } from "@/lib/utils/storage";
import type { Slot, StyleItem } from "../engine";

const PLACES: Record<Slot, string> = {
  top: "lx-booth__slot--top",
  bottom: "lx-booth__slot--bottom",
  accessory: "lx-booth__slot--accessory",
  shoes: "lx-booth__slot--shoes",
};

function HangerHook() {
  return (
    <svg viewBox="0 0 100 40" className="lx-hook lx-booth__hook" aria-hidden="true">
      <path d="M50 3c4 0 6 4 3 7-2 1-3 2-3 5" />
      <path d="M50 15 8 36h84z" />
    </svg>
  );
}

// La cabine d'essayage : les pièces du look pendues dans une arche. Toucher un cintre choisit la
// catégorie à changer, la croix retire la pièce, le rideau se tire pour « essayer ».
export function FittingBooth({
  pieces,
  activeSlot,
  onSelect,
  onRemove,
  children,
}: {
  pieces: Partial<Record<Slot, StyleItem>>;
  activeSlot: Slot;
  onSelect: (slot: Slot) => void;
  onRemove: (slot: Slot) => void;
  children?: ReactNode;
}) {
  const t = useTranslations("outfits");
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!closed) return;
    const timer = window.setTimeout(() => setClosed(false), 1400);
    return () => window.clearTimeout(timer);
  }, [closed]);

  return (
    <div className="flex w-full flex-col items-center gap-3.5">
      <div className="lx-booth" data-closed={closed ? "" : undefined}>
        <span className="lx-booth__bar" aria-hidden="true" />
        <ul className="lx-booth__grid">
          {(Object.keys(PLACES) as Slot[]).map((slot) => {
            const piece = pieces[slot];
            const label = t(`slots.${slot}`);
            return (
              <li key={slot} className={`lx-booth__slot ${PLACES[slot]}`}>
                <HangerHook />
                <button
                  type="button"
                  className={cn("lx-booth__frame", activeSlot === slot && "is-active")}
                  data-empty={piece ? undefined : ""}
                  aria-pressed={activeSlot === slot}
                  aria-label={t("selectSlot", { slot: label })}
                  onClick={() => onSelect(slot)}
                  disabled={closed}
                >
                  {piece?.imagePath ? (
                    <Image src={productImageUrl(piece.imagePath)} alt={piece.title} fill unoptimized sizes="10rem" className="object-cover" />
                  ) : null}
                  <span className="lx-booth__label">{label}</span>
                </button>
                {piece ? (
                  <button type="button" className="lx-booth__remove" aria-label={`${t("remove")} ${label}`} onClick={() => onRemove(slot)} disabled={closed}>
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <span className="lx-booth__pelmet" aria-hidden="true" />
        <span className="lx-booth__curtain lx-booth__curtain--left" aria-hidden="true" />
        <span className="lx-booth__curtain lx-booth__curtain--right" aria-hidden="true" />
        {closed ? <span className="lx-booth__busy" role="status">{t("busy")}</span> : null}
      </div>
      <div className="flex w-[min(100%,380px)] flex-wrap justify-center gap-2.5">
        <button type="button" className="lx-booth__try flex-[1_1_140px]" onClick={() => setClosed(true)} disabled={closed}>
          {t("tryOn")}
        </button>
        {children}
      </div>
    </div>
  );
}
