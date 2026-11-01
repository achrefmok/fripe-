import { getLocale, getTranslations } from "next-intl/server";
import { Input } from "@/components/ui/input";
import { AdminCancelOrderButton } from "@/features/admin/components/market-actions";
import { Pagination } from "@/features/admin/components/pagination";
import { OrderStatusTag } from "@/features/orders/components/order-status-tag";
import { listAllOrders, ORDER_PAGE_SIZE } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

const STATUSES = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"] as const;

export default async function AdminOrdersPage({
  searchParams,
}: PageProps<"/[locale]/admin/commandes">) {
  await requireAdmin("/admin/commandes");
  const { statut, page, q } = await searchParams;

  const status = STATUSES.find((value) => value === statut) ?? null;
  const currentPage = Math.max(Number(page) || 1, 1);
  const reference = typeof q === "string" ? q.trim().slice(0, 30) : "";

  const [{ orders, total }, t, statusLabel, catalog, locale] = await Promise.all([
    listAllOrders(status, currentPage, reference),
    getTranslations("adminMarket"),
    getTranslations("orderStatus"),
    getTranslations("catalog"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("ordersTitle")}</h1>

      <form className="mt-4 max-w-md" role="search">
        <Input
          name="q"
          type="search"
          dir="ltr"
          defaultValue={reference}
          aria-label={t("searchOrders")}
          placeholder={t("searchOrders")}
        />
      </form>

      <nav aria-label={t("ordersTitle")} className="rail-scroll mt-4 flex gap-1 overflow-x-auto">
        {[null, ...STATUSES].map((value) => (
          <Link
            key={value ?? "all"}
            href={value ? `/admin/commandes?statut=${value}` : "/admin/commandes"}
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
        <ul className="mt-4 divide-y border-y">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/commandes/${order.id}`} className="font-semibold underline underline-offset-4" dir="ltr">
                  {order.order_groups?.reference}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {order.shops?.name} · {formatDate(order.created_at, locale)}
                </p>
              </div>
              <OrderStatusTag status={order.status} />
              <span className="font-semibold">{formatPrice(order.total_millimes, locale)}</span>
              {order.status !== "delivered" && order.status !== "cancelled" ? (
                <AdminCancelOrderButton orderId={order.id} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("ordersEmpty")}</p>
      )}

      <Pagination
        page={currentPage}
        total={total}
        pageSize={ORDER_PAGE_SIZE}
        basePath="/admin/commandes"
        params={{ ...(status ? { statut: status } : {}), ...(reference ? { q: reference } : {}) }}
      />
    </>
  );
}
