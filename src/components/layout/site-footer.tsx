import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const LEGAL_LINKS = [
  ["/mentions-legales", "legal"],
  ["/cgu", "terms"],
  ["/cgv", "sales"],
  ["/confidentialite", "privacy"],
  ["/cookies", "cookies"],
  ["/retours", "returns"],
  ["/livraison", "delivery"],
  ["/informations-vendeurs", "sellers"],
  ["/support", "support"],
] as const;

export function SiteFooter() {
  const t = useTranslations("footer");
  const locale = useLocale();

  return (
    <footer className="mt-5 border-t pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-[18px] gap-y-3 px-[18px] py-7">
        <span dir="ltr" className="font-display text-2xl">Friptex</span>
        <p className="text-[13px] text-muted-foreground md:me-auto">{t("tagline")}</p>
        <ul className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-[13px] text-muted-foreground">
          {LEGAL_LINKS.map(([href, key]) => (
            <li key={href}>
              <Link href={href} prefetch={false} className="inline-flex min-h-8 items-center hover:text-harissa">
                {t(key)}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/" locale={locale === "ar" ? "fr" : "ar"} className="inline-flex min-h-8 items-center font-[family-name:var(--font-arabic)] hover:text-harissa">
              {locale === "ar" ? "Français" : "عربي"}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
