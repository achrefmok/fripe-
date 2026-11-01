import { getLocale, getTranslations } from "next-intl/server";
import { getCategories } from "@/features/catalog/queries";
import { AlertForm, AlertRowActions } from "@/features/social/components/social-controls";
import { listAlerts, listFollowedShops } from "@/features/social/queries";
import { requireViewer } from "@/lib/permissions/viewer";
import { formatPrice } from "@/lib/utils/price";

export default async function AlertsPage() {
  const viewer = await requireViewer("/compte/alertes");
  const [alerts, categories, shops, t, locale] = await Promise.all([
    listAlerts(viewer.id),
    getCategories(),
    listFollowedShops(viewer.id),
    getTranslations("social"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("alertsTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("alertsLead")}</p>

      {alerts.length ? (
        <ul className="mt-6 divide-y border-y">
          {alerts.map((alert) => (
            <li key={alert.id} className="grid gap-1 py-3">
              <p className="font-semibold">
                {alert.name}
                {alert.is_active ? "" : ` · ${t("alertPaused")}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {[
                  ...alert.sizes,
                  ...alert.brands,
                  alert.max_price_millimes ? formatPrice(alert.max_price_millimes, locale) : null,
                  alert.followed_only ? t("alertFollowedOnly") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <AlertRowActions alertId={alert.id} isActive={alert.is_active} />
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">{t("alertCreate")}</h2>
        <div className="mt-3">
          <AlertForm
            categories={categories
              .filter((category) => !category.parentId)
              .map((category) => ({
                id: category.id,
                name: locale === "ar" ? category.nameAr : category.nameFr,
              }))}
            followedShops={shops.map((shop) => ({ id: shop.id, name: shop.name }))}
          />
        </div>
      </section>
    </>
  );
}
