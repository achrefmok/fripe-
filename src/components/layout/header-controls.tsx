"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";

export function ThemeToggle() {
  const t = useTranslations("common");
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("theme")}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}

export function LocaleSwitch() {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <Button variant="ghost" asChild className="px-3">
      <Link href={pathname} locale={locale === "ar" ? "fr" : "ar"} aria-label={t("languageLabel")}>
        <Languages />
        <span lang={locale === "ar" ? "fr" : "ar"}>{t("language")}</span>
      </Link>
    </Button>
  );
}
