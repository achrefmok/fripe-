import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionBrowse } from "@/features/marketplace/components/section-browse";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("marketplaceTitle"), description: t("marketplaceBody") };
}

export default async function MarketplacePage({ params, searchParams }: PageProps<"/[locale]/marketplace">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SectionBrowse section="marketplace" searchParams={await searchParams} />;
}
