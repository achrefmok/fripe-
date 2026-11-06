"use client";

import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBadges } from "@/hooks/use-badges";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

// Le compte sur téléphone : la barre du bas porte les vidéos, le compte monte dans l'en-tête,
// avec sa pastille de notifications.
export function AccountLink() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const badges = useBadges();
  const active = pathname.startsWith("/compte") && !pathname.startsWith("/compte/annonces/nouvelle");

  return (
    <Link
      href="/compte"
      aria-label={t("account")}
      aria-current={active ? "page" : undefined}
      className={cn("relative inline-flex size-11 items-center justify-center hover:text-harissa md:hidden", active && "text-harissa")}
    >
      <UserRound className="size-5" strokeWidth={active ? 2.4 : 1.8} />
      {badges > 0 ? (
        <span data-testid="account-badge" className="absolute end-2 top-2 size-2.5 rounded-full bg-harissa" />
      ) : null}
    </Link>
  );
}
