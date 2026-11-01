import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("terms") };
}

export default async function TermsPage({ params }: PageProps<"/[locale]/cgu">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="terms" />;
}
