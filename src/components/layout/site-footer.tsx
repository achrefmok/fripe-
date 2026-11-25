import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FooterLanguage } from "./footer-language";
import { PartnerCredit } from "./partner-credit";

const EXPLORE_LINKS = [
  ["/catalogue", "mode"],
  ["/vide-dressing", "videDressing"],
  ["/marketplace", "marketplace"],
  ["/boutiques", "shops"],
  ["/lives", "lives"],
  ["/walk", "walk"],
  ["/stylist", "aiStylist"],
  ["/tenues/nouvelle", "outfitBuilder"],
] as const;

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

// Le pied de page : la marque, les rubriques, l'aide et, dans sa propre section, le choix de la langue.
export function SiteFooter() {
  const t = useTranslations("footer");
  const nav = useTranslations("nav");

  return (
    <footer className="lx-footer">
      <div className="lx-footer__inner">
        <div className="lx-footer__group lx-footer__group--brand">
          <span dir="ltr" className="font-display text-[34px] leading-none">Friptex</span>
          <p className="max-w-[26ch] text-sm leading-relaxed text-muted-foreground">{t("tagline")}</p>
        </div>

        <nav className="lx-footer__group" aria-label={t("explore")}>
          <h2 className="lx-footer__title">{t("explore")}</h2>
          <ul className="lx-footer__links">
            {EXPLORE_LINKS.map(([href, key]) => (
              <li key={href}>
                <Link href={href} prefetch={false} className="lx-footer__link">{nav(key)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="lx-footer__group" aria-label={t("help")}>
          <h2 className="lx-footer__title">{t("help")}</h2>
          <ul className="lx-footer__links">
            {LEGAL_LINKS.map(([href, key]) => (
              <li key={href}>
                <Link href={href} prefetch={false} className="lx-footer__link">{t(key)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <FooterLanguage title={t("language")} hint={t("languageHint")} />
      </div>
      <div className="border-t border-border px-[18px] py-5">
        <PartnerCredit variant="footer" />
      </div>
    </footer>
  );
}
