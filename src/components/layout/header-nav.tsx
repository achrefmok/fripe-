"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Les rubriques de l'en-tête : la rubrique courante est soulignée d'un filet d'or.
export function HeaderNav({ label, links }: { label: string; links: { href: string; label: string; wide?: boolean }[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="luxe-nav max-md:hidden">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn("luxe-nav__link", link.wide && "max-[1099px]:hidden", active && "is-active")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
