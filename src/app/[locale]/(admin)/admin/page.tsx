import { getLocale, getTranslations } from "next-intl/server";
import { ShopReviewActions } from "@/features/admin/components/admin-actions";
import { getAdminStats, getLastMaintenance, getModerationCounts, listShops } from "@/features/admin/queries";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { formatDate, localizedName } from "@/lib/utils/format";

export async function generateMetadata() {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

export default async function AdminOverviewPage() {
  await requireAdmin("/admin");
  const [stats, moderation, maintenance, queue, t, locale] = await Promise.all([
    getAdminStats(),
    getModerationCounts(),
    getLastMaintenance(),
    listShops("pending", 1),
    getTranslations("admin"),
    getLocale(),
  ]);

  const figures = [
    { label: t("statPending"), value: stats.pendingShops, href: "/admin/boutiques?statut=pending" },
    { label: t("statApproved"), value: stats.approvedShops, href: "/admin/boutiques?statut=approved" },
    { label: t("statUsers"), value: stats.users, href: "/admin/utilisateurs" },
    { label: t("statSuspended"), value: stats.suspendedUsers, href: "/admin/utilisateurs" },
    { label: t("statReports"), value: moderation.openReports, href: "/admin/signalements" },
    { label: t("statHiddenReviews"), value: moderation.hiddenReviews, href: "/admin/avis?statut=hidden" },
  ];

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("navOverview")}</h1>

      <dl className="mt-6 grid grid-cols-2 border-t border-s lg:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.label} className="border-e border-b">
            <Link href={figure.href} className="block p-4 transition-colors hover:bg-muted">
              <dt className="text-sm text-muted-foreground">{figure.label}</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums">{figure.value}</dd>
            </Link>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-sm text-muted-foreground">
        {maintenance
          ? t("maintenanceLast", { date: formatDate(maintenance.started_at, locale), status: maintenance.status })
          : t("maintenanceNever")}
      </p>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-display text-xl font-bold">{t("queueTitle")}</h2>
          <Link href="/admin/boutiques" className="text-sm font-semibold underline underline-offset-4">
            {t("seeAll")}
          </Link>
        </div>

        {queue.shops.length ? (
          <ul className="mt-4 divide-y border-y">
            {queue.shops.map((shop) => (
              <li key={shop.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{shop.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {shop.cities && localizedName(shop.cities, locale)} ·{" "}
                    {formatDate(shop.created_at, locale)}
                  </p>
                </div>
                <ShopReviewActions shopId={shop.id} shopName={shop.name} status={shop.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-muted-foreground">{t("queueEmpty")}</p>
        )}
      </section>
    </>
  );
}
