"use client";

import { Home, Plus, UserRound } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useTranslations } from "next-intl";
import { useBadges } from "@/hooks/use-badges";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { CabinIcon, HangerIcon } from "./luxe-icons";

// Friptex Luxe : une barre flottante en verre. L'accueil, le portant à chiner, la vente au centre
// sur un disque d'or, la cabine d'essayage et le compte.
const TABS: {
  href: string;
  key: "home" | "chine" | "sellShort" | "cabine" | "account";
  icon: ComponentType<SVGProps<SVGSVGElement> & { strokeWidth?: number }>;
  isActive: (pathname: string) => boolean;
}[] = [
  { href: "/", key: "home", icon: Home, isActive: (path) => path === "/" },
  { href: "/chine", key: "chine", icon: HangerIcon, isActive: (path) => path.startsWith("/chine") },
  { href: "/vendre", key: "sellShort", icon: Plus, isActive: (path) => path.startsWith("/vendre") || path.startsWith("/compte/annonces/nouvelle") },
  { href: "/tenues/nouvelle", key: "cabine", icon: CabinIcon, isActive: (path) => path.startsWith("/tenues") },
  { href: "/compte", key: "account", icon: UserRound, isActive: (path) => path.startsWith("/compte") && !path.startsWith("/compte/annonces/nouvelle") },
];

export function MobileTabbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const badges = useBadges();

  return (
    <nav aria-label={t("mainLabel")} className="luxe-tabbar md:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, key, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          const sell = key === "sellShort";

          return (
            <li key={key}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("luxe-tab", active && "is-active")}>
                <span className={cn("relative grid place-items-center", sell && "luxe-tab__sell")}>
                  <Icon className={sell ? "size-5" : "size-[21px]"} strokeWidth={sell ? 2.4 : active ? 2 : 1.6} />
                  {key === "account" && badges > 0 ? (
                    <span data-testid="account-badge" className="absolute -end-1.5 -top-1 size-2.5 rounded-full bg-harissa" />
                  ) : null}
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
