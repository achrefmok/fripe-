import { setRequestLocale } from "next-intl/server";
import { use } from "react";

// La page de découverte a sa propre barre et son propre pied de page : pas d'en-tête du site,
// pas de barre d'onglets.
export default function LandingLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  return <>{children}</>;
}
