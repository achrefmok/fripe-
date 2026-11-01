import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("cookies") };
}

export default async function CookiesPage({ params }: PageProps<"/[locale]/cookies">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="cookies" />;
}
