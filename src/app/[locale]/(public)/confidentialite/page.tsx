import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("privacy") };
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/confidentialite">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="privacy" />;
}
