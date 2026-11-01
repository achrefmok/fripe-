import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("notice") };
}

export default async function LegalNoticePage({ params }: PageProps<"/[locale]/mentions-legales">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="notice" />;
}
