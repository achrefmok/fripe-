"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
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

// La cabine d'essayage : les pièces du look pendues dans une arche, et un rideau qu'on tire
// pour « essayer ». Purement visuelle : le choix des pièces reste dans la liste en dessous.
export function FittingBooth({ pieces, total, budget }: { pieces: Partial<Record<Slot, StyleItem>>; total: number; budget: number | null }) {
  const t = useTranslations("outfits");
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!closed) return;
    const timer = window.setTimeout(() => setClosed(false), 1400);
    return () => window.clearTimeout(timer);
  }, [closed]);

  const ratio = budget ? Math.min(1, total / budget) : 0;
  const over = budget !== null && total > budget;

  return (
    <div className="flex flex-col items-center gap-3.5">
      <div className="lx-booth" data-closed={closed ? "" : undefined}>
        <span className="lx-booth__bar" aria-hidden="true" />
        <ul className="lx-booth__grid">
          {(Object.keys(PLACES) as Slot[]).map((slot) => {
            const piece = pieces[slot];
            return (
              <li key={slot} className={`lx-booth__slot ${PLACES[slot]}`}>
                <HangerHook />
                <span className="lx-booth__frame" data-empty={piece ? undefined : ""}>
                  {piece?.imagePath ? (
                    <Image src={productImageUrl(piece.imagePath)} alt={piece.title} fill unoptimized sizes="10rem" className="object-cover" />
                  ) : null}
                  <span className="lx-booth__label">{t(`slots.${slot}`)}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <span className="lx-booth__pelmet" aria-hidden="true" />
        <span className="lx-booth__curtain lx-booth__curtain--left" aria-hidden="true" />
        <span className="lx-booth__curtain lx-booth__curtain--right" aria-hidden="true" />
        {closed ? <span className="lx-booth__busy" role="status">{t("busy")}</span> : null}
      </div>
      <button type="button" className="lx-booth__try" onClick={() => setClosed(true)} disabled={closed}>
        {t("tryOn")}
      </button>
      {budget !== null ? (
        <div className="w-full max-w-[380px]" aria-hidden="true">
          <div className="h-2 overflow-hidden rounded-full bg-cream">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(ratio * 100)}%`, background: over ? "var(--destructive)" : "var(--gold)" }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
