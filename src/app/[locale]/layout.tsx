import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Alexandria, Bodoni_Moda, Jost } from "next/font/google";
import { notFound } from "next/navigation";
import { PageCurtain } from "@/components/layout/page-curtain";
import { Providers } from "@/components/layout/providers";
import { directionOf, routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/env";
import { Contentsquare } from "./contentsquare";
import "../globals.css";

// Friptex Luxe : un didone à contraste pour les titres, une géométrique douce pour le texte.
const display = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-wordmark",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

const body = Jost({
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
    { media: "(prefers-color-scheme: light)", color: "#f8f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
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
        <Contentsquare />
        <NextIntlClientProvider>
          <Providers dir={dir}>
            {children}
            <PageCurtain />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
