"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import type { MouseEvent, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

// Le haut du Vide-Dressing : la garance, la phrase, et trois pièces en éventail qui se tournent
// vers la souris, comme on écarte des cintres pour regarder.
export function VdHero({
  kicker,
  title,
  lead,
  sell,
  discover,
  stat,
  photos,
}: {
  kicker: string;
  title: ReactNode;
  lead: string;
  sell: string;
  discover: string;
  stat: string;
  photos: string[];
}) {
  function follow(event: MouseEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    event.currentTarget.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
  }

  function rest(event: MouseEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--rx", "0deg");
    event.currentTarget.style.setProperty("--ry", "0deg");
  }

  return (
    <section className="vd-hero" onMouseMove={follow} onMouseLeave={rest} aria-labelledby="vd-titre">
      <div className="vd-hero__text">
        <p className="vd-hero__kicker">{kicker}</p>
        <h1 id="vd-titre" className="vd-hero__title">{title}</h1>
        <p className="vd-hero__lead">{lead}</p>
        <div className="flex flex-wrap items-center gap-2.5 pt-1.5">
          <Link href="/compte/annonces/nouvelle?rubrique=vide_dressing" className="vd-hero__cta">
            <Plus className="size-4" aria-hidden="true" />
            {sell}
          </Link>
          <a href="#dressings" className="vd-hero__ghost">{discover}</a>
        </div>
        <p className="vd-hero__stat">{stat}</p>
      </div>

      {photos.length ? (
        <div className="vd-hero__stage" aria-hidden="true">
          <div className="vd-hero__fan">
            {photos.slice(0, 3).map((src, index) => (
              <span key={src} className="vd-hero__piece" data-slot={index}>
                <Image src={src} alt="" fill unoptimized priority={index === 0} sizes="14rem" className="object-cover" />
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
