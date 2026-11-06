"use client";

import { Clapperboard, Package, Store, type LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// L'espace vendeur s'organise autour de trois actions : la boutique, les produits, les vidéos.
// Le reste (ventes, échanges, avis) reste à un geste, dans une rangée secondaire.
const PRIMARY: { key: "myShop" | "myProducts" | "myVideos"; icon: LucideIcon; paths: string[] }[] = [
  { key: "myShop", icon: Store, paths: ["", "/reglages"] },
  { key: "myProducts", icon: Package, paths: ["/produits", "/publication-rapide", "/collections", "/stock"] },
  { key: "myVideos", icon: Clapperboard, paths: ["/videos"] },
];

const PRODUCT_PAGES = [
  ["products", "/produits"],
  ["quick", "/publication-rapide"],
  ["collections", "/collections"],
  ["stock", "/stock"],
] as const;

const ACTIVITY = [
  ["orders", "/commandes"],
  ["messages", "/messages"],
  ["requests", "/demandes"],
  ["reviews", "/avis"],
  ["blocks", "/blocages"],
] as const;

type Label =
  | (typeof PRIMARY)[number]["key"]
  | (typeof PRODUCT_PAGES)[number][0]
  | (typeof ACTIVITY)[number][0]
  | "activity"
  | "sections";

export function ShopTabs({ shopId, labels }: { shopId: string; labels: Record<Label, string> }) {
  const pathname = usePathname();
  const base = `/vendeur/boutique/${shopId}`;
  const at = (path: string) => (path ? pathname.startsWith(`${base}${path}`) : pathname === base);
  const inProducts = PRIMARY[1].paths.some(at);

  return (
    <>
      <nav aria-label={labels.sections} className="seller-nav">
        {PRIMARY.map(({ key, icon: Icon, paths }) => {
          const active = paths.some(at);
          return (
            <Link
              key={key}
              href={`${base}${paths[0]}`}
              aria-current={active ? "page" : undefined}
              className={cn("seller-nav__item", active && "is-active")}
            >
              <Icon className="size-6" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              <span>{labels[key]}</span>
            </Link>
          );
        })}
      </nav>

      {inProducts ? (
        <nav aria-label={labels.myProducts} className="rail-scroll -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
          {PRODUCT_PAGES.map(([key, path]) => (
            <Link
              key={key}
              href={`${base}${path}`}
              aria-current={at(path) ? "page" : undefined}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
                at(path) ? "border-harissa text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {labels[key]}
            </Link>
          ))}
        </nav>
      ) : null}

      <nav aria-label={labels.activity} className="rail-scroll -mx-4 mt-3 flex items-center gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
        <span className="shrink-0 pe-1 text-xs font-semibold text-muted-foreground">{labels.activity}</span>
        {ACTIVITY.map(([key, path]) => (
          <Link
            key={key}
            href={`${base}${path}`}
            aria-current={at(path) ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center border px-3 text-sm font-medium transition-colors",
              at(path) ? "border-foreground bg-foreground text-background" : "hover:border-foreground",
            )}
          >
            {labels[key]}
          </Link>
        ))}
      </nav>
    </>
  );
}
