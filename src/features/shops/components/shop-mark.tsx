import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { shopAssetUrl } from "@/lib/utils/storage";

// Mots trop courants pour distinguer deux boutiques : « Boutique Démo A » donne « DA », pas « B ».
const GENERIC = new Set(["boutique", "friperie", "fripe", "shop", "store", "la", "le", "les", "l", "de", "du", "des", "d", "chez", "the", "et"]);

// Les matières des univers, avec un texte lisible dessus.
const TONES = [
  ["oklch(0.5 0.185 31)", "oklch(0.97 0.012 85)"],
  ["oklch(0.38 0.075 255)", "oklch(0.97 0.012 85)"],
  ["oklch(0.74 0.085 72)", "oklch(0.2 0.014 55)"],
  ["oklch(0.47 0.135 5)", "oklch(0.97 0.012 85)"],
  ["oklch(0.4 0.06 125)", "oklch(0.97 0.012 85)"],
  ["oklch(0.76 0.125 82)", "oklch(0.2 0.014 55)"],
] as const;

export function shopInitials(name: string) {
  const words = name.split(/[\s'’-]+/).filter(Boolean);
  const meaningful = words.filter((word) => !GENERIC.has(word.toLowerCase()));

  return (meaningful.length ? meaningful : words)
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase() ?? "")
    .join("");
}

// La même boutique garde toujours la même couleur.
export function shopTone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return TONES[hash % TONES.length];
}

export function ShopMark({
  name,
  logoPath,
  size = "sm",
  className,
}: {
  name: string;
  logoPath?: string | null;
  size?: "xs" | "sm" | "lg";
  className?: string;
}) {
  if (logoPath) {
    return (
      <span className={cn("shop-mark", className)} data-size={size}>
        <Image src={shopAssetUrl(logoPath)} alt="" fill unoptimized sizes="64px" className="object-cover" />
      </span>
    );
  }

  const [background, color] = shopTone(name);

  return (
    <span aria-hidden="true" className={cn("shop-mark", className)} data-size={size} style={{ background, color } as CSSProperties}>
      {shopInitials(name)}
    </span>
  );
}
