import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("support") };
}

export default async function SupportPage({ params }: PageProps<"/[locale]/support">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="support" />;
}
