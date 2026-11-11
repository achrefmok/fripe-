"use client";

import { Clapperboard, Package, Radio, ReceiptText, Store, type LucideIcon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type PrimaryKey = "myShop" | "myProducts" | "mySales" | "myVideos" | "myLives";

// L'espace vendeur tient en cinq destinations : la boutique, les produits, les ventes, les vidéos et
// les Lives. Chacune ouvre, si besoin, une seule rangée de sous-pages : on ne cherche jamais plus loin.
const PRIMARY: { key: PrimaryKey; icon: LucideIcon; paths: string[] }[] = [
  { key: "myShop", icon: Store, paths: ["", "/reglages"] },
  { key: "myProducts", icon: Package, paths: ["/produits", "/arrivages", "/publication-rapide", "/collections", "/stock"] },
  { key: "mySales", icon: ReceiptText, paths: ["/commandes", "/demandes", "/messages", "/avis", "/blocages"] },
  { key: "myVideos", icon: Clapperboard, paths: ["/videos"] },
  { key: "myLives", icon: Radio, paths: ["/lives"] },
];

const SUB_PAGES = {
  myShop: [
    ["overview", ""],
    ["settings", "/reglages"],
  ],
  myProducts: [
    ["products", "/produits"],
    ["arrivals", "/arrivages"],
    ["quick", "/publication-rapide"],
    ["collections", "/collections"],
    ["stock", "/stock"],
  ],
  mySales: [
    ["orders", "/commandes"],
    ["requests", "/demandes"],
    ["messages", "/messages"],
    ["reviews", "/avis"],
    ["blocks", "/blocages"],
  ],
} as const;

type SubKey = (typeof SUB_PAGES)[keyof typeof SUB_PAGES][number][0];
type Label = PrimaryKey | SubKey | "sections";

export function ShopTabs({
  shopId,
  labels,
  badges = {},
}: {
  shopId: string;
  labels: Record<Label, string>;
  badges?: Partial<Record<PrimaryKey, number>>;
}) {
  const pathname = usePathname();
  const base = `/vendeur/boutique/${shopId}`;
  const at = (path: string) => (path ? pathname.startsWith(`${base}${path}`) : pathname === base);
  const current = PRIMARY.find(({ paths }) => paths.some(at))?.key ?? "myShop";
  const subPages = current in SUB_PAGES ? SUB_PAGES[current as keyof typeof SUB_PAGES] : null;

  return (
    <>
      <nav aria-label={labels.sections} className="seller-nav">
        {PRIMARY.map(({ key, icon: Icon, paths }) => {
          const active = key === current;
          const badge = badges[key] ?? 0;
          return (
            <Link
              key={key}
              href={`${base}${paths[0]}`}
              aria-current={active ? "page" : undefined}
              className={cn("seller-nav__item", active && "is-active")}
            >
              <span className="relative grid place-items-center">
                <Icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.7} aria-hidden="true" />
                {badge > 0 ? <span className="seller-nav__badge">{badge > 99 ? "99+" : badge}</span> : null}
              </span>
              <span>{labels[key]}</span>
            </Link>
          );
        })}
      </nav>

      {subPages ? (
        <nav aria-label={labels[current]} className="seller-subnav rail-scroll">
          {subPages.map(([key, path]) => (
            <Link key={key} href={`${base}${path}`} aria-current={at(path) ? "page" : undefined} className={cn("seller-subnav__item", at(path) && "is-active")}>
              {labels[key]}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
