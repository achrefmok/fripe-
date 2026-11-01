import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("returns") };
}

export default async function ReturnsPage({ params }: PageProps<"/[locale]/retours">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="returns" />;
}
