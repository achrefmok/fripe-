import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/permissions/viewer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  const t = await getTranslations("admin");
  const market = await getTranslations("adminMarket");
  const moderation = await getTranslations("moderation");
  const nav = await getTranslations("nav");
  const reference = await getTranslations("adminReference");
  const reviews = await getTranslations("reviews");
  const listings = await getTranslations("market");

  return (
    <AppShell
      title={t("title")}
      links={[
        { href: "/admin", label: t("navOverview"), icon: "overview", exact: true },
        { href: "/admin/boutiques", label: t("navShops"), icon: "store" },
        { href: "/admin/produits", label: market("navProducts"), icon: "products" },
        { href: "/admin/videos", label: market("navVideos"), icon: "videos" },
        { href: "/admin/annonces", label: listings("adminTitle"), icon: "listings" },
        { href: "/admin/commandes", label: market("navOrders"), icon: "orders" },
        { href: "/admin/utilisateurs", label: t("navUsers"), icon: "users" },
        { href: "/admin/signalements", label: moderation("adminTitle"), icon: "reports" },
        { href: "/admin/avis", label: reviews("title"), icon: "reviews" },
        { href: "/admin/categories", label: reference("categoriesTitle"), icon: "categories" },
        { href: "/admin/lieux", label: reference("locationsTitle"), icon: "locations" },
        { href: "/admin/audit", label: t("navAudit"), icon: "audit" },
        { href: "/compte", label: nav("account"), icon: "account" },
      ]}
    >
      {children}
    </AppShell>
  );
}
