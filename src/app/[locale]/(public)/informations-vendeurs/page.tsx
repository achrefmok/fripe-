import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("sellers") };
}

export default async function SellersPage({ params }: PageProps<"/[locale]/informations-vendeurs">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="sellers" />;
}
