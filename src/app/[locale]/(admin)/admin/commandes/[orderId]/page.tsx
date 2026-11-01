import { notFound } from "next/navigation";
import { AdminCancelOrderButton } from "@/features/admin/components/market-actions";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getOrder } from "@/features/orders/queries";
import { requireAdmin } from "@/lib/permissions/viewer";

export default async function AdminOrderPage({
  params,
}: PageProps<"/[locale]/admin/commandes/[orderId]">) {
  const { orderId } = await params;
  await requireAdmin(`/admin/commandes/${orderId}`);

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    notFound();
  }

  const order = await getOrder(orderId);

  if (!order) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <p className="mb-3 font-semibold">{order.shops?.name}</p>
      <OrderDetail order={order} />
      {order.status !== "delivered" && order.status !== "cancelled" ? (
        <div className="mt-6">
          <AdminCancelOrderButton orderId={order.id} />
        </div>
      ) : null}
    </div>
  );
}
