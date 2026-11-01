import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Alexandria, Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { notFound } from "next/navigation";
import { Providers } from "@/components/layout/providers";
import { StagingBanner } from "@/components/layout/staging-banner";
import { directionOf, routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/env";
import "../globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-wordmark",
  axes: ["opsz", "wdth"],
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

const arabic = Alexandria({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: t("title"), template: "%s · FRIPE" },
    description: t("description"),
    applicationName: "FRIPE",
    appleWebApp: { capable: true, title: "FRIPE", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe4" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1712" },
  ],
  viewportFit: "cover",
  // Le clavier virtuel réduit la mise en page au lieu de recouvrir les champs (Android Chrome).
  interactiveWidget: "resizes-content",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const dir = directionOf(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${arabic.variable}`}
    >
      <body className="flex min-h-svh flex-col">
        <NextIntlClientProvider>
          <Providers dir={dir}>
            <StagingBanner />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
