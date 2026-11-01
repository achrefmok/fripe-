import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { OrderStatusTag } from "@/features/orders/components/order-status-tag";
import { listMyOrders } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { formatDate } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

export default async function MyOrdersPage() {
  const viewer = await requireViewer("/compte/commandes");
  const [orders, t, locale] = await Promise.all([
    listMyOrders(viewer.id),
    getTranslations("orders"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <div className="mt-6">
        {orders.length ? (
          <ul className="divide-y border-y">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/compte/commandes/${order.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{order.shops?.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      <span dir="ltr">{order.order_groups?.reference}</span> ·{" "}
                      {t("items", { count: order.order_items.length })} ·{" "}
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
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
      </div>
    </>
  );
}
