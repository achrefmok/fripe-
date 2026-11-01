import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("sales") };
}

export default async function SalesPage({ params }: PageProps<"/[locale]/cgv">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="sales" />;
}
