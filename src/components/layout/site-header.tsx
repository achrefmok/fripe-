import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLink } from "./brand";
import { LocaleSwitch, ThemeToggle } from "./header-controls";

// Les trois expériences d'abord, puis les services de la mode, puis le compte.
export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 md:px-6">
        <BrandLink className="me-auto" />
        <nav aria-label={t("mainLabel")} className="hidden items-center gap-1 md:flex">
          <span className="header-sections">
            <Link href="/catalogue" className="header-section">{t("mode")}</Link>
            <Link href="/marketplace" className="header-section">{t("marketplace")}</Link>
            <Link href="/vide-dressing" className="header-section">{t("videDressing")}</Link>
          </span>
          <Link href="/boutiques" className="hidden px-3 py-2 text-sm font-semibold hover:text-harissa lg:inline-flex">
            {t("shops")}
          </Link>
          <Link href="/walk" className="hidden px-3 py-2 text-sm font-semibold hover:text-harissa lg:inline-flex">
            {t("walk")}
          </Link>
          <Link href="/stylist" className="hidden px-3 py-2 text-sm font-semibold hover:text-harissa xl:inline-flex">
            {t("stylist")}
          </Link>
          <Link href="/vendre" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("sell")}
          </Link>
          <Link href="/compte" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("account")}
          </Link>
        </nav>
        {/* Le panier quitte la barre du bas pour laisser la place aux trois rubriques. */}
        <Link href="/panier" aria-label={t("cart")} className="inline-flex size-11 items-center justify-center hover:text-harissa">
          <ShoppingBag className="size-5" />
        </Link>
        <LocaleSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}
