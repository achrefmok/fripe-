"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cutoutUrl } from "@/lib/ui/cutout";

// Une pièce telle qu'on la porte : la photo est détourée pour ne garder que le vêtement. Quand le
// fond ne se laisse pas retirer (gros plan, décor chargé), la photo est taillée à la forme de la
// pièce : un haut, un bas, ou un médaillon pour les chaussures et les accessoires.
export function Garment({ src, sizes, slot }: { src: string; sizes: string; slot: string }) {
  const [result, setResult] = useState<{ src: string; url: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    void cutoutUrl(src).then((url) => {
      if (live) setResult({ src, url });
    });
    return () => {
      live = false;
    };
  }, [src]);

  const ready = result?.src === src;
  const cut = ready ? result.url : null;

  return (
    <span className="lx-garment" data-slot={slot} data-state={!ready ? "pending" : cut ? "cut" : "plain"}>
      <Image src={cut ?? src} alt="" fill sizes={sizes} draggable={false} />
    </span>
  );
}
