import { getLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("seller");
  const nav = await getTranslations("nav");

  if (!(await getViewer())) {
    return redirect({
      href: { pathname: "/connexion", query: { next: "/vendeur" } },
      locale: await getLocale(),
    });
  }

  return (
    <AppShell
      title={t("title")}
      links={[
        { href: "/vendeur", label: t("navShops"), icon: "store", exact: true },
        { href: "/vendeur/creer-boutique", label: t("navCreate"), icon: "plus" },
        { href: "/compte", label: nav("account"), icon: "account" },
      ]}
    >
      {children}
    </AppShell>
  );
}
