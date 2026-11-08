"use client";

import {
  Clapperboard,
  Flag,
  LayoutDashboard,
  MapPin,
  Package,
  PackageOpen,
  Plus,
  ReceiptText,
  ScrollText,
  Sofa,
  Star,
  Store,
  Tags,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandLink } from "./brand";
import { LocaleSwitch, ThemeToggle } from "./header-controls";
import { SignOutButton } from "./sign-out-button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  account: UserRound,
  arrivals: PackageOpen,
  audit: ScrollText,
  categories: Tags,
  locations: MapPin,
  reviews: Star,
  orders: ReceiptText,
  overview: LayoutDashboard,
  plus: Plus,
  products: Package,
  listings: Sofa,
  delivery: Truck,
  reports: Flag,
  store: Store,
  users: Users,
  videos: Clapperboard,
};

// Une clé plutôt qu'un composant : un Server Component ne peut pas transmettre de fonction ici.
export type ShellLink = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

function LinkIcon({ name }: { name: ShellLink["icon"] }) {
  const Icon = ICONS[name];
  return <Icon className="size-4" />;
}

// Coque des espaces de travail : le portant devient un rail vertical sur grand écran,
// et une barre d'onglets défilante sur téléphone.
export function AppShell({
  title,
  links,
  children,
}: {
  title: string;
  links: ShellLink[];
  children: ReactNode;
}) {
  const pathname = usePathname();

  const isActive = ({ href, exact }: ShellLink) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-e md:sticky md:top-0 md:flex md:h-svh">
        <div className="flex h-14 items-center px-5">
          <BrandLink />
        </div>
        <p className="px-5 pb-3 pt-4 text-sm font-semibold text-muted-foreground">{title}</p>
        <nav aria-label={title} className="grid gap-0.5 px-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link) ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-2.5 px-3 text-sm font-medium transition-colors",
                isActive(link)
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <LinkIcon name={link.icon} />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-2">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center gap-1 px-4 md:px-6">
            <BrandLink className="me-auto md:hidden" />
            <div className="ms-auto flex items-center gap-1">
              <LocaleSwitch />
              <ThemeToggle />
            </div>
          </div>
          <nav
            aria-label={title}
            className="rail-scroll flex gap-1 overflow-x-auto px-3 pb-2 md:hidden"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link) ? "page" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 px-3 text-sm font-medium",
                  isActive(link) ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                <LinkIcon name={link.icon} />
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        <main id="contenu" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
