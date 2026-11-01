import { getLocale, getTranslations } from "next-intl/server";
import { Pagination } from "@/features/admin/components/pagination";
import { ReleaseReservationButton } from "@/features/orders/components/order-actions";
import { OrderStatusTag } from "@/features/orders/components/order-status-tag";
import { listShopOrders, listShopReservations, ORDER_PAGE_SIZE } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

const STATUSES = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"] as const;

export default async function ShopOrdersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/commandes">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const { statut, page } = await searchParams;
  const status = STATUSES.find((value) => value === statut) ?? null;
  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ orders, total }, reservations, t, statusLabel, catalog, orderLabels, locale] =
    await Promise.all([
      listShopOrders(shopId, status, currentPage),
      listShopReservations(shopId),
      getTranslations("sellerShop"),
      getTranslations("orderStatus"),
      getTranslations("catalog"),
      getTranslations("orders"),
      getLocale(),
    ]);

  const base = `/vendeur/boutique/${shopId}/commandes`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {reservations.length ? (
        <section>
          <h2 className="font-display text-xl font-bold">{t("reservationsTitle")}</h2>
          <ul className="mt-2 divide-y border-y">
            {reservations.map((reservation) => (
              <li key={reservation.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{reservation.products?.title}</span>
                  <span className="block text-sm text-muted-foreground">
                    {t("reservationsUntil", { date: formatDateTime(reservation.expires_at, locale) })}
                  </span>
                </span>
                <ReleaseReservationButton reservationId={reservation.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="font-display text-xl font-bold">{t("ordersTitle")}</h2>
        <nav aria-label={t("ordersTitle")} className="rail-scroll mt-2 flex gap-1 overflow-x-auto">
          {[null, ...STATUSES].map((value) => (
            <Link
              key={value ?? "all"}
              href={value ? `${base}?statut=${value}` : base}
              aria-current={value === status ? "true" : undefined}
              className={cn(
                "flex h-9 shrink-0 items-center px-3 text-sm font-medium",
                value === status ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {value ? statusLabel(value) : catalog("all")}
            </Link>
          ))}
        </nav>

        {orders.length ? (
          <ul className="mt-3 divide-y border-y">
            {orders.map((order) => (
              <li key={order.id}>
                <Link href={`${base}/${order.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold" dir="ltr">{order.order_groups?.reference}</span>
                    <span className="block text-sm text-muted-foreground">
                      {order.order_groups?.recipient_name} ·{" "}
                      {orderLabels("items", { count: order.order_items.length })} ·{" "}
                      {formatDate(order.created_at, locale)}
                    </span>
                  </span>
                  <OrderStatusTag status={order.status} />
                  <span className="font-semibold">{formatPrice(order.total_millimes, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-muted-foreground">{t("ordersEmpty")}</p>
        )}

        <Pagination
          page={currentPage}
          total={total}
          pageSize={ORDER_PAGE_SIZE}
          basePath={base}
          params={status ? { statut: status } : {}}
        />
      </section>
    </div>
  );
}
