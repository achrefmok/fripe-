import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { formatDateTime, localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";
import type { getOrder } from "../queries";
import { OrderStatusTag } from "./order-status-tag";

type Order = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export function OrderDetail({
  order,
  references,
}: {
  order: Order;
  references?: Map<string, string>;
}) {
  const t = useTranslations("orders");
  const checkout = useTranslations("checkout");
  const locale = useLocale();
  const group = order.order_groups;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-bold" dir="ltr">{group?.reference}</h2>
        <OrderStatusTag status={order.status} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(order.created_at, locale)}</p>

      {order.cancel_reason ? (
        <p className="mt-3 bg-secondary px-3 py-2 text-sm">
          {t("cancelReasonShown", { reason: order.cancel_reason })}
        </p>
      ) : null}

      <ul className="mt-5 divide-y border-y">
        {order.order_items.map((item) => (
          <li key={item.id}>
            <Link href={`/produit/${item.product_id}`} className="flex items-center gap-3 py-3">
              <span className="relative size-16 shrink-0 overflow-hidden bg-secondary">
                {item.image_path ? (
                  <Image src={productImageUrl(item.image_path)} alt="" fill sizes="64px" className="object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {[item.brand, item.size, references?.get(item.product_id)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="font-semibold">{formatPrice(item.price_millimes, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid gap-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("subtotal")}</dt>
          <dd>{formatPrice(order.subtotal_millimes, locale)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{t("deliveryFee")}</dt>
          <dd>{formatPrice(order.delivery_fee_millimes, locale)}</dd>
        </div>
        <div className="flex justify-between text-base font-bold">
          <dt>{t("total")}</dt>
          <dd>{formatPrice(order.total_millimes, locale)}</dd>
        </div>
      </dl>

      <dl className="mt-5 grid gap-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t("recipient")}</dt>
          <dd className="font-medium">{group?.recipient_name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("phone")}</dt>
          <dd className="font-medium" dir="ltr">{group?.phone}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("address")}</dt>
          <dd className="font-medium">
            {order.fulfillment === "pickup" ? (
              t("pickupNote")
            ) : (
              <>
                {group?.address_line}
                {group?.cities ? `, ${localizedName(group.cities, locale)}` : ""}
                {group?.governorates ? `, ${localizedName(group.governorates, locale)}` : ""}
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{checkout("payment")}</dt>
          <dd className="font-medium">{checkout("cod")}</dd>
        </div>
      </dl>
    </>
  );
}
