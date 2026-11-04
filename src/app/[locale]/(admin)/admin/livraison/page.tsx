import { getLocale, getTranslations } from "next-intl/server";
import { PlatformDeliveryForm } from "@/features/orders/components/platform-delivery-form";
import { getPlatformDeliverySettings, listRecentShipments } from "@/features/orders/queries";
import { getLocations } from "@/features/shops/queries";
import { formatDateTime } from "@/lib/utils/format";
import { formatPrice, millimesToInput } from "@/lib/utils/price";

export default async function AdminDeliveryPage() {
  const [settings, locations, shipments, t, tracking, locale] = await Promise.all([
    getPlatformDeliverySettings(),
    getLocations(),
    listRecentShipments(),
    getTranslations("delivery"),
    getTranslations("tracking"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("adminTitle")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("adminLead")}</p>

      <section className="mt-8 max-w-3xl">
        <PlatformDeliveryForm
          governorates={locations.map((location) => ({ id: location.id, nameFr: location.nameFr, nameAr: location.nameAr }))}
          defaultFee={millimesToInput(settings.defaultMillimes)}
          rates={Object.fromEntries([...settings.rates].map(([id, fee]) => [String(id), millimesToInput(fee)]))}
        />
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-extrabold">{t("shipmentsTitle")}</h2>
        {shipments.length ? (
          <ul className="mt-4 divide-y border-y text-sm">
            {shipments.map((shipment) => (
              <li key={shipment.order_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold" dir="ltr">{shipment.tracking_code}</span>
                  <span className="block text-muted-foreground">
                    {shipment.orders?.order_groups?.reference} · {shipment.orders?.shops?.name} · {shipment.orders?.order_groups?.recipient_name}
                  </span>
                </span>
                <span className="text-end">
                  <span className="block font-medium">{tracking(`status.${shipment.status}`)}</span>
                  <span className="block text-muted-foreground">
                    {shipment.orders ? formatPrice(shipment.orders.total_millimes, locale) : ""} · {formatDateTime(shipment.updated_at, locale)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-muted-foreground">{t("shipmentsEmpty")}</p>
        )}
      </section>
    </>
  );
}
