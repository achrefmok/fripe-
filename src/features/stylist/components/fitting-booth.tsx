"use client";

import { Pencil, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { productImageUrl } from "@/lib/utils/storage";
import type { Slot, StyleItem } from "../engine";
import { Garment } from "./garment";

const PLACES: Record<Slot, string> = {
  top: "lx-booth__slot--top",
  outer: "lx-booth__slot--outer",
  dress: "lx-booth__slot--dress",
  bottom: "lx-booth__slot--bottom",
  accessory: "lx-booth__slot--accessory",
  shoes: "lx-booth__slot--shoes",
};

// Devant le miroir, les pièces détourées se superposent comme on s'habille : le bas, la robe, le haut
// qui retombe dessus, la veste par-dessus, les chaussures au sol, l'accessoire à portée de main.
const LOOK_ORDER: Slot[] = ["bottom", "dress", "top", "outer", "shoes", "accessory"];

function HangerHook() {
  return (
    <svg viewBox="0 0 100 40" className="lx-hook lx-booth__hook" aria-hidden="true">
      <path d="M50 3c4 0 6 4 3 7-2 1-3 2-3 5" />
      <path d="M50 15 8 36h84z" />
    </svg>
  );
}

// La cabine d'essayage. Dans la cabine, chaque pièce pend à son cintre : toucher un emplacement
// choisit la catégorie à changer, la croix retire la pièce. On tire le rideau, et il se rouvre sur
// le miroir : le look entier, assemblé, où chaque pièce reste modifiable.
export function FittingBooth({
  pieces,
  activeSlot,
  onSelect,
  onRemove,
  summary,
  children,
}: {
  pieces: Partial<Record<Slot, StyleItem>>;
  activeSlot: Slot;
  onSelect: (slot: Slot) => void;
  onRemove: (slot: Slot) => void;
  summary: string;
  children?: ReactNode;
}) {
  const t = useTranslations("outfits");
  const reduced = useReducedMotion();
  const [closed, setClosed] = useState(false);
  const [mode, setMode] = useState<"booth" | "mirror">("booth");
  const frame = useRef<HTMLDivElement>(null);
  const count = Object.values(pieces).filter(Boolean).length;
  // Sans pièce, il n'y a rien à regarder : le miroir rend la main à la cabine.
  const view = count ? mode : "booth";

  // Rideau fermé : on change de décor derrière lui, puis il se rouvre.
  useEffect(() => {
    if (!closed) return;
    const swap = window.setTimeout(() => setMode((current) => (current === "booth" ? "mirror" : "booth")), reduced ? 0 : 750);
    const open = window.setTimeout(() => setClosed(false), reduced ? 50 : 1300);
    return () => {
      window.clearTimeout(swap);
      window.clearTimeout(open);
    };
  }, [closed, reduced]);

  function pull() {
    if (view === "booth" && !count) {
      toast.info(t("emptyLook"));
      return;
    }
    setClosed(true);
    frame.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" });
  }

  const spring = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 22 };

  return (
    <div className="flex w-full flex-col items-center gap-3.5">
      <div ref={frame} className="lx-booth" data-closed={closed ? "" : undefined} data-mode={view}>
        {view === "booth" ? (
          <>
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
                      <AnimatePresence initial={false}>
                        {piece?.imagePath ? (
                          <motion.span
                            key={piece.id}
                            className="absolute inset-0"
                            initial={{ opacity: 0, y: -18, rotate: -4 }}
                            animate={{ opacity: 1, y: 0, rotate: 0 }}
                            exit={{ opacity: 0, y: 14, scale: 0.94 }}
                            transition={spring}
                          >
                            <Image src={productImageUrl(piece.imagePath)} alt={piece.title} fill sizes="10rem" className="object-cover" />
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
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
          </>
        ) : (
          <div className="lx-mirror" role="group" aria-label={t("mirrorTitle")}>
            <span className="lx-mirror__sheen" aria-hidden="true" />
            <span className="lx-mirror__floor" aria-hidden="true" />
            <AnimatePresence initial>
              {LOOK_ORDER.map((slot, order) => {
                const piece = pieces[slot];
                if (!piece) return null;
                const label = t(`slots.${slot}`);
                return (
                  <motion.button
                    key={`${slot}-${piece.id}`}
                    type="button"
                    className={cn("lx-mirror__piece", `lx-mirror__piece--${slot}`, activeSlot === slot && "is-active")}
                    aria-label={`${t("replace")} ${label} : ${piece.title}`}
                    onClick={() => onSelect(slot)}
                    disabled={closed}
                    initial={{ opacity: 0, y: 36, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={reduced ? { duration: 0 } : { ...spring, delay: 0.12 * order }}
                    whileHover={reduced ? undefined : { scale: 1.04 }}
                    whileTap={reduced ? undefined : { scale: 0.97 }}
                  >
                    {piece.imagePath ? <Garment src={productImageUrl(piece.imagePath)} sizes="18rem" slot={slot} /> : null}
                    <span className="lx-mirror__edit" aria-hidden="true">
                      <Pencil className="size-3" />
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        <span className="lx-booth__pelmet" aria-hidden="true" />
        <span className="lx-booth__curtain lx-booth__curtain--left" aria-hidden="true" />
        <span className="lx-booth__curtain lx-booth__curtain--right" aria-hidden="true" />
        {closed ? <span className="lx-booth__busy" role="status">{t("busy")}</span> : null}
      </div>

      {view === "mirror" ? (
        <div className="flex max-w-[360px] flex-col items-center gap-1.5 text-center">
          <p className="lx-mirror__caption">
            <span className="lx-mirror__kicker">{t("mirrorKicker")}</span>
            <span className="font-display text-2xl leading-tight">{summary}</span>
          </p>
          <p className="text-sm text-muted-foreground">{t("mirrorHint")}</p>
        </div>
      ) : null}

      <div className="flex w-[min(100%,440px)] flex-wrap justify-center gap-2.5">
        <button type="button" className="lx-booth__try flex-[1_1_140px]" onClick={pull} disabled={closed}>
          {view === "mirror" ? t("backToBooth") : t("tryOn")}
        </button>
        {children}
      </div>
    </div>
  );
}
