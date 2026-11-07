import { getLocale, getTranslations } from "next-intl/server";
import { AppShell, type ShellLink } from "@/components/layout/app-shell";
import { getMyShops } from "@/features/shops/queries";
import { redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";

// Un vendeur, une boutique : la navigation mène droit à elle.
export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("seller");
  const nav = await getTranslations("nav");
  const viewer = await getViewer();

  if (!viewer) {
    return redirect({
      href: { pathname: "/connexion", query: { next: "/vendeur" } },
      locale: await getLocale(),
    });
  }

  const shops = await getMyShops(viewer.id);
  const shopLinks: ShellLink[] =
    shops.length === 0
      ? [{ href: "/vendeur/creer-boutique", label: t("emptyCta"), icon: "plus" }]
      : shops.length === 1
        ? [{ href: `/vendeur/boutique/${shops[0].id}`, label: t("navMyShop"), icon: "store" }]
        : [{ href: "/vendeur", label: t("navShops"), icon: "store", exact: true }];

  return (
    <AppShell title={t("title")} links={[...shopLinks, { href: "/compte", label: nav("account"), icon: "account" }]}>
      {children}
    </AppShell>
  );
}
