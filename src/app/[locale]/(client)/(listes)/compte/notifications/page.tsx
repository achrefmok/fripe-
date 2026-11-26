import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { MarkAllRead, PreferencesForm } from "@/features/social/components/social-controls";
import { getPreferences, listNotifications } from "@/features/social/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

export default async function NotificationsPage() {
  const viewer = await requireViewer("/compte/notifications");
  const [notifications, preferences, t, market, media, locale] = await Promise.all([
    listNotifications(viewer.id),
    getPreferences(viewer.id),
    getTranslations("social"),
    getTranslations("market"),
    getTranslations("mediaModeration"),
    getLocale(),
  ]);

  const hasUnread = notifications.some((notification) => !notification.read_at);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">{t("notificationsTitle")}</h1>
        {hasUnread ? <MarkAllRead /> : null}
      </div>

      <div className="mt-6">
        {notifications.length ? (
          <ul className="divide-y border-y">
            {notifications.map((notification) => (
              <li key={notification.id}>
                {notification.kind === "media_blocked" ? (
                  // Réservée aux administrateurs : le rapport d'un média bloqué par la modération.
                  <Link
                    href={{ pathname: "/admin/medias", query: notification.media_moderation_events ? { compte: notification.media_moderation_events.user_id } : {} }}
                    className={cn("block py-3", notification.read_at ? "text-muted-foreground" : "font-semibold")}
                  >
                    <span className="block">
                      {notification.media_moderation_events
                        ? media("notification", {
                            category: media(`categories.${notification.media_moderation_events.category as "sexual_explicit"}`),
                            context: media(`contexts.${notification.media_moderation_events.context as "product_image"}`),
                          })
                        : media("navTitle")}
                    </span>
                    {notification.media_moderation_events ? (
                      <span className="block text-sm font-normal" dir="auto">
                        {media("notificationBody", {
                          account: notification.media_moderation_events.user_id,
                          sanction: media(`sanctions.${notification.media_moderation_events.sanction as "none"}`),
                        })}
                      </span>
                    ) : null}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatDateTime(notification.created_at, locale)}
                    </span>
                  </Link>
                ) : notification.kind === "listing_message" ? (
                  <Link
                    href={`/compte/echanges/${notification.listing_thread_id}`}
                    className={cn("block py-3", notification.read_at ? "text-muted-foreground" : "font-semibold")}
                  >
                    <span className="block">
                      {market("notifListingMessage", { title: notification.listing_threads?.listing_title ?? "" })}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatDateTime(notification.created_at, locale)}
                    </span>
                  </Link>
                ) : (
                <Link
                  href={`/produit/${notification.product_id}`}
                  className={cn("block py-3", notification.read_at ? "text-muted-foreground" : "font-semibold")}
                >
                  <span className="block">
                    {t("dropTitle", { name: notification.drop_alerts?.name ?? "" })}
                  </span>
                  <span className="block text-sm">
                    {notification.products?.title}
                    {notification.products?.price_millimes
                      ? ` · ${formatPrice(notification.products.price_millimes, locale)}`
                      : ""}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {formatDateTime(notification.created_at, locale)}
                  </span>
                </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("notificationsEmptyTitle")} body={t("notificationsEmptyBody")} />
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold">{t("preferences")}</h2>
        <div className="mt-3">
          <PreferencesForm defaults={preferences} />
        </div>
      </section>
    </>
  );
}
