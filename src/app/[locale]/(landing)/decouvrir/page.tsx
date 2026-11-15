import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Landing } from "@/features/landing/components/landing";
import { getLandingData } from "@/features/landing/data";

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps<"/[locale]/decouvrir">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return {
    title: { absolute: t("metaTitle") },
    description: t("metaDescription"),
    alternates: { languages: { fr: "/decouvrir", ar: "/ar/decouvrir" } },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), type: "website" },
  };
}

export default async function DiscoverPage({ params }: PageProps<"/[locale]/decouvrir">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await getLandingData(locale);
  return <Landing data={data} />;
}
