"use client";

import { ArrowRight, Heart, Layers, MessageSquareText, Sparkles } from "lucide-react";
import Image from "next/image";
import { useLocale } from "next-intl";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import type { DressingItem } from "../queries";
import { Hanger } from "./hanger";

type Closet = {
  sellerId: string;
  sign: string;
  enter: string;
  pieces: DressingItem[];
};

// Le haut du Vide-Dressing : la garance, la phrase, et une armoire dont les portes s'ouvrent sur le
// portant d'un vrai dressing. Les pièces se balancent encore un peu, la lumière passe entre les
// portes, et l'armoire se tourne vers la souris.
export function VdHero({
  kicker,
  title,
  lead,
  explore,
  crush,
  perks,
  doorsLabel,
  closet,
}: {
  kicker: string;
  title: ReactNode;
  lead: string;
  explore: string;
  crush: string;
  perks: { offer: string; lot: string; crush: string };
  doorsLabel: string;
  closet: Closet | null;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  // Les portes s'ouvrent juste après l'arrivée : le temps de voir l'armoire fermée.
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), 450);
    return () => window.clearTimeout(timer);
  }, []);

  function follow(event: MouseEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    event.currentTarget.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
    event.currentTarget.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
  }

  function rest(event: MouseEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--rx", "0deg");
    event.currentTarget.style.setProperty("--ry", "0deg");
  }

  return (
    <section className="vd-hero" onMouseMove={follow} onMouseLeave={rest} aria-labelledby="vd-titre">
      <span className="vd-hero__glow" aria-hidden="true" />
      <div className="vd-hero__text">
        <p className="vd-hero__kicker vd-reveal" style={{ "--d": 0 } as CSSProperties}>
          <span className="vd-live-dot" aria-hidden="true" />
          {kicker}
        </p>
        <h1 id="vd-titre" className="vd-hero__title vd-reveal" style={{ "--d": 1 } as CSSProperties}>
          {title}
        </h1>
        <p className="vd-hero__lead vd-reveal" style={{ "--d": 2 } as CSSProperties}>
          {lead}
        </p>
        <div className="vd-hero__actions vd-reveal" style={{ "--d": 3 } as CSSProperties}>
          <a href="#dressings" className="vd-hero__cta">
            {explore}
            <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </a>
          <Link href="/vide-dressing/coup-de-foudre" className="vd-hero__ghost">
            <Heart className="size-4" aria-hidden="true" />
            {crush}
          </Link>
        </div>
        <ul className="vd-hero__perks vd-reveal" style={{ "--d": 4 } as CSSProperties}>
          <li>
            <MessageSquareText className="size-3.5" aria-hidden="true" />
            {perks.offer}
          </li>
          <li>
            <Layers className="size-3.5" aria-hidden="true" />
            {perks.lot}
          </li>
          <li>
            <Sparkles className="size-3.5" aria-hidden="true" />
            {perks.crush}
          </li>
        </ul>
      </div>

      {closet && closet.pieces.length ? (
        <div className="vd-wardrobe" data-open={open ? "" : undefined}>
          <div className="vd-wardrobe__box">
            <Link href={`/vide-dressing/dressing/${closet.sellerId}`} className="vd-wardrobe__inside" aria-label={closet.enter} tabIndex={open ? undefined : -1}>
              <span className="vd-wardrobe__sign" aria-hidden="true">{closet.sign}</span>
              <span className="vd-wardrobe__rod" aria-hidden="true" />
              <span className="vd-wardrobe__light" aria-hidden="true" />
              <span className="vd-wardrobe__rail" aria-hidden="true">
                {closet.pieces.slice(0, 3).map((piece, index) => (
                  <span key={piece.id} className="vd-wardrobe__piece" style={{ "--k": index } as CSSProperties}>
                    <Hanger className="vd-wardrobe__hanger" />
                    <span className="vd-wardrobe__photo">
                      {piece.imageUrl ? <Image src={piece.imageUrl} alt="" fill priority={index < 2} sizes="8rem" className="object-cover" /> : null}
                    </span>
                    <span className="vd-wardrobe__tag">{formatPrice(piece.priceMillimes, locale)}</span>
                  </span>
                ))}
              </span>
            </Link>
            <button type="button" className="vd-wardrobe__door vd-wardrobe__door--left" onClick={() => setOpen((value) => !value)} aria-label={doorsLabel} aria-expanded={open}>
              <span className="vd-wardrobe__panel" aria-hidden="true" />
              <span className="vd-wardrobe__knob" aria-hidden="true" />
            </button>
            <button type="button" className="vd-wardrobe__door vd-wardrobe__door--right" onClick={() => setOpen((value) => !value)} aria-hidden="true" tabIndex={-1}>
              <span className="vd-wardrobe__panel" aria-hidden="true" />
              <span className="vd-wardrobe__knob" aria-hidden="true" />
            </button>
          </div>
          <span className="vd-wardrobe__floor" aria-hidden="true" />
        </div>
      ) : null}
    </section>
  );
}
