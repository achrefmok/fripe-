"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { activeUniverse, UNIVERSES, type UniverseKey } from "./universe-links";

// Les trois rubriques de FRIPE, sous l'en-tête de toutes les pages publiques et du compte :
// la Marketplace (tout le reste), la Mode des boutiques, le Vide-Dressing des particuliers.
export function UniverseNav() {
  const home = useTranslations("home");
  const market = useTranslations("market");
  const pathname = usePathname();
  const active = activeUniverse(pathname);
  const labels: Record<UniverseKey, string> = {
    marketplace: market("marketplaceTitle"),
    mode: home("rubriqueMode"),
    videDressing: market("videDressingTitle"),
  };

  return (
    <div className="luxe-universes">
      <nav aria-label={home("rubriquesLabel")} className="lx-segment luxe-universes__nav">
        {UNIVERSES.map(({ key, href }) => (
          <Link
            key={key}
            href={href}
            aria-current={active === key ? "page" : undefined}
            className="lx-segment__item luxe-universes__item"
          >
            {labels[key]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
