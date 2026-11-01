import { setRequestLocale } from "next-intl/server";
import { LegalPage, legalTitle } from "@/features/legal/legal-page";

export async function generateMetadata() {
  return { title: await legalTitle("delivery") };
}

export default async function DeliveryPage({ params }: PageProps<"/[locale]/livraison">) {
  setRequestLocale((await params).locale);

  return <LegalPage slug="delivery" />;
}
