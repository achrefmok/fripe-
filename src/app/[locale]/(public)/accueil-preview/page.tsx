import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewHome } from "@/features/home/preview/new-home";

export const revalidate = 60;

// Prévisualisation du nouvel accueil. L'accueil officiel reste « / » : aucun remplacement sans
// autorisation explicite. Page non indexée.
export async function generateMetadata({ params }: PageProps<"/[locale]/accueil-preview">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "homePreview" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function HomePreviewPage({ params }: PageProps<"/[locale]/accueil-preview">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NewHome locale={locale} route="/accueil-preview" />;
}
