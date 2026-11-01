"use client";

import { Clapperboard, Home, Search, ShoppingBag, UserRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBadges } from "@/hooks/use-badges";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS: {
  href: string;
  key: "home" | "catalog" | "walk" | "cart" | "account";
  icon: LucideIcon;
}[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/catalogue", key: "catalog", icon: Search },
  { href: "/walk", key: "walk", icon: Clapperboard },
  { href: "/panier", key: "cart", icon: ShoppingBag },
  { href: "/compte", key: "account", icon: UserRound },
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
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-15 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold transition-colors",
                  active ? "text-harissa" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
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
