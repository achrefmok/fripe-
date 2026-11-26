import { Heart, ShoppingBag, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLink } from "./brand";
import { HeaderNav } from "./header-nav";
import { InstallButton } from "./install-button";
import { LocaleSwitch, ThemeToggle } from "./header-controls";
import { PartnerCredit } from "./partner-credit";
import { UniverseNav } from "./universe-nav";

// Friptex Luxe : un bandeau de verre, la marque, les rubriques soulignées d'or, puis les gestes rapides.
// Sous l'en-tête, une frise de zellige fine.
export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <>
      <header className="luxe-header">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-[18px] py-2.5">
          <BrandLink />
          <PartnerCredit />
          <HeaderNav
            label={t("mainLabel")}
            links={[
              // Mode, Marketplace et Vide-Dressing vivent dans la barre des rubriques, juste dessous.
              { href: "/boutiques", label: t("shops"), wide: true },
              { href: "/walk", label: t("walk"), wide: true },
              { href: "/lives", label: t("lives"), wide: true },
              { href: "/chine", label: t("chine") },
              { href: "/tenues/nouvelle", label: t("cabine") },
              { href: "/vendre", label: t("sell") },
            ]}
          />
          <span className="ms-auto flex items-center gap-0.5 max-[359px]:gap-0">
            <InstallButton />
            <ThemeToggle />
            <LocaleSwitch compact />
            <Link href="/compte/favoris" aria-label={t("favorites")} className="luxe-icon-button">
              <Heart className="size-[19px]" strokeWidth={1.6} />
            </Link>
            <Link href="/panier" aria-label={t("cart")} className="luxe-icon-button">
              <ShoppingBag className="size-[19px]" strokeWidth={1.6} />
            </Link>
            <Link href="/compte" aria-label={t("account")} className="luxe-icon-button max-md:hidden">
              <UserRound className="size-[19px]" strokeWidth={1.6} />
            </Link>
          </span>
        </div>
      </header>
      <UniverseNav />
      <div className="zellige" aria-hidden="true" />
    </>
  );
}
