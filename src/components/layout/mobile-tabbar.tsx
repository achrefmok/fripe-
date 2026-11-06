"use client";

import { Clapperboard, Home, Plus, Shirt, Sofa, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Trois expériences et la vidéo : la mode, les objets divers, le Vide-Dressing et Fripe Walk, avec la
// vente au centre, à portée de pouce. Le compte est dans l'en-tête.
const MODE_PATHS = ["/catalogue", "/produit", "/boutique", "/stylist", "/tenues", "/panier", "/commande"];

const TABS: {
  href: string;
  key: "mode" | "marketplace" | "sellShort" | "videDressing" | "videos";
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}[] = [
  { href: "/", key: "mode", icon: Home, isActive: (path) => path === "/" || MODE_PATHS.some((base) => path.startsWith(base)) },
  { href: "/marketplace", key: "marketplace", icon: Sofa, isActive: (path) => path.startsWith("/marketplace") },
  { href: "/vendre", key: "sellShort", icon: Plus, isActive: (path) => path.startsWith("/vendre") || path.startsWith("/compte/annonces/nouvelle") },
  { href: "/vide-dressing", key: "videDressing", icon: Shirt, isActive: (path) => path.startsWith("/vide-dressing") },
  { href: "/walk", key: "videos", icon: Clapperboard, isActive: (path) => path.startsWith("/walk") },
];

export function MobileTabbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("mainLabel")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, key, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          const sell = key === "sellShort";

          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tabbar-link flex h-15 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold transition-colors",
                  active ? "text-harissa" : "text-muted-foreground",
                )}
              >
                <span className={cn("relative", sell && "tabbar-sell")}>
                  <Icon className="size-5" strokeWidth={sell ? 2.6 : active ? 2.4 : 1.8} />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
