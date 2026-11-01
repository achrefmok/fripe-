import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Wordmark } from "./brand";

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

  return (
    <footer className="border-t pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:px-6">
        <Wordmark className="text-xl" />
        <p className="text-sm text-muted-foreground md:me-auto">{t("tagline")}</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium md:max-w-xl md:justify-end">
          {LEGAL_LINKS.map(([href, key]) => (
            <li key={href}>
              <Link href={href} prefetch={false} className="inline-flex min-h-8 items-center underline-offset-4 hover:underline">
                {t(key)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
