import { getTranslations, setRequestLocale } from "next-intl/server";
import { SectionBrowse } from "@/features/marketplace/components/section-browse";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("videDressingTitle"), description: t("videDressingBody") };
}

export default async function VideDressingPage({ params, searchParams }: PageProps<"/[locale]/vide-dressing">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <SectionBrowse section="vide_dressing" searchParams={await searchParams} />;
}
