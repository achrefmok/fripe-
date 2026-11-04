"use client";

import { Home, Plus, Shirt, Sofa, UserRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBadges } from "@/hooks/use-badges";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Trois expériences, un seul compte : la mode, la Marketplace et le Vide-Dressing, avec la vente
// au centre, à portée de pouce.
const MODE_PATHS = ["/catalogue", "/produit", "/boutique", "/walk", "/stylist", "/tenues", "/panier", "/commande"];

const TABS: {
  href: string;
  key: "mode" | "marketplace" | "sellShort" | "videDressing" | "account";
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}[] = [
  { href: "/", key: "mode", icon: Home, isActive: (path) => path === "/" || MODE_PATHS.some((base) => path.startsWith(base)) },
  { href: "/marketplace", key: "marketplace", icon: Sofa, isActive: (path) => path.startsWith("/marketplace") },
  { href: "/vendre", key: "sellShort", icon: Plus, isActive: (path) => path.startsWith("/vendre") || path.startsWith("/compte/annonces/nouvelle") },
  { href: "/vide-dressing", key: "videDressing", icon: Shirt, isActive: (path) => path.startsWith("/vide-dressing") },
  { href: "/compte", key: "account", icon: UserRound, isActive: (path) => path.startsWith("/compte") && !path.startsWith("/compte/annonces/nouvelle") },
];

export function MobileTabbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const badges = useBadges();

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
                  {key === "account" && badges > 0 ? (
                    <span
                      data-testid="account-badge"
                      className="absolute -end-1.5 -top-1 size-2.5 rounded-full bg-harissa"
                    />
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
