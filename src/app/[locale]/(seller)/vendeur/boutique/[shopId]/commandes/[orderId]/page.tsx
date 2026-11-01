import { notFound } from "next/navigation";
import { getReferences } from "@/features/catalog/queries";
import { OrderActions } from "@/features/orders/components/order-actions";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getOrder } from "@/features/orders/queries";
import { nextOrderStatus } from "@/features/orders/schemas";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function ShopOrderPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/commandes/[orderId]">) {
  const { shopId, orderId } = await params;
  await requireShopAccess(shopId);

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    notFound();
  }

  const order = await getOrder(orderId);

  if (!order || order.shop_id !== shopId) {
    notFound();
  }

  const references = await getReferences(order.order_items.map((item) => item.product_id));
  const open = !["delivered", "cancelled"].includes(order.status);

  return (
    <div className="max-w-2xl">
      <OrderDetail order={order} references={references} />
      {open ? (
        <div className="mt-6">
          <OrderActions
            orderId={order.id}
            next={nextOrderStatus(order.status, order.fulfillment)}
            canCancel={order.status !== "shipped"}
          />
        </div>
      ) : null}
    </div>
  );
}
