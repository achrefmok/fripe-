"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  ["overview", ""],
  ["products", "/produits"],
  ["quick", "/publication-rapide"],
  ["collections", "/collections"],
  ["stock", "/stock"],
  ["videos", "/videos"],
  ["messages", "/messages"],
  ["orders", "/commandes"],
  ["requests", "/demandes"],
  ["reviews", "/avis"],
  ["blocks", "/blocages"],
  ["settings", "/reglages"],
] as const;

export function ShopTabs({
  shopId,
  labels,
}: {
  shopId: string;
  labels: Record<(typeof TABS)[number][0], string>;
}) {
  const pathname = usePathname();
  const base = `/vendeur/boutique/${shopId}`;

  return (
    <nav aria-label={labels.overview} className="rail-scroll -mx-4 mt-4 flex gap-1 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      {TABS.map(([key, path]) => {
        const href = `${base}${path}`;
        const active = path ? pathname.startsWith(href) : pathname === href;

        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "border-harissa text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {labels[key]}
          </Link>
        );
      })}
    </nav>
  );
}
