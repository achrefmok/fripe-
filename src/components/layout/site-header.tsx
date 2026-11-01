import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BrandLink } from "./brand";
import { LocaleSwitch, ThemeToggle } from "./header-controls";

export function SiteHeader() {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 md:px-6">
        <BrandLink className="me-auto" />
        <nav aria-label={t("mainLabel")} className="hidden items-center gap-1 md:flex">
          <Link href="/catalogue" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("catalog")}
          </Link>
          <Link href="/boutiques" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("shops")}
          </Link>
          <Link href="/walk" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("walk")}
          </Link>
          <Link href="/stylist" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("stylist")}
          </Link>
          <Link href="/panier" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("cart")}
          </Link>
          <Link href="/vendeur" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("sell")}
          </Link>
          <Link href="/compte" className="px-3 py-2 text-sm font-semibold hover:text-harissa">
            {t("account")}
          </Link>
        </nav>
        <LocaleSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}
