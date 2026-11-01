import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { ReservationActions } from "@/features/orders/components/reservation-actions";
import { listMyReservations } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { formatDateTime } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

export default async function MyReservationsPage() {
  const viewer = await requireViewer("/compte/reservations");
  const [reservations, t, locale] = await Promise.all([
    listMyReservations(viewer.id),
    getTranslations("reservations"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <div className="mt-6">
        {reservations.length ? (
          <ul className="divide-y border-y">
            {reservations.map((reservation) => {
              const expired =
                reservation.status === "expired" ||
                (reservation.status === "active" && new Date(reservation.expires_at) <= new Date());
              const label = expired ? "expired" : reservation.status;

              return (
                <li key={reservation.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link href={`/produit/${reservation.product_id}`} className="truncate font-semibold">
                      {reservation.products?.title}
                    </Link>
                    <span className="shrink-0 font-semibold">
                      {reservation.products?.price_millimes
                        ? formatPrice(reservation.products.price_millimes, locale)
                        : null}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`status.${label}`)}
                    {label === "active"
                      ? ` · ${t("expiresAt", { date: formatDateTime(reservation.expires_at, locale) })}`
                      : ""}
                  </p>
                  {expired ? (
                    <p className="text-sm text-muted-foreground">{t("expiredHelp")}</p>
                  ) : null}
                  {label === "active" ? (
                    <div className="mt-2">
                      <ReservationActions
                        reservationId={reservation.id}
                        productId={reservation.product_id}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
      </div>
    </>
  );
}
