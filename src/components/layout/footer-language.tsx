"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { locale: "fr", label: "Français", dir: "ltr" },
  { locale: "ar", label: "العربية", dir: "rtl" },
] as const;

// Le choix de la langue en bas de page : chaque langue s'écrit dans son alphabet et son sens de
// lecture, et l'on reste sur la page où l'on se trouve.
export function FooterLanguage({ title, hint }: { title: string; hint: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "ar" ? "fr" : "ar";

  return (
    <div className="lx-footer__group">
      <h2 className="lx-footer__title">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {LANGUAGES.map((language) => (
          <li key={language.locale}>
            <Link
              href={pathname}
              locale={language.locale}
              lang={language.locale}
              dir={language.dir}
              hrefLang={language.locale}
              aria-current={locale === language.locale ? "true" : undefined}
              className={cn(
                "lx-footer__lang",
                language.locale === "ar" && "font-[family-name:var(--font-arabic)]",
                locale === language.locale && "is-active",
              )}
            >
              {language.label}
            </Link>
          </li>
        ))}
      </ul>
      <p
        lang={other}
        dir={other === "ar" ? "rtl" : "ltr"}
        className={cn("text-[13px] leading-relaxed text-muted-foreground", other === "ar" && "font-[family-name:var(--font-arabic)]")}
      >
        {hint}
      </p>
    </div>
  );
}
