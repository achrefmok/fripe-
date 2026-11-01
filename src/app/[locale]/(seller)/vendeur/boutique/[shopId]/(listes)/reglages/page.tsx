import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { DeliveryRatesForm } from "@/features/orders/components/delivery-fee-form";
import { LogoUploader } from "@/features/shops/components/shop-actions";
import { EditShopForm } from "@/features/shops/components/shop-forms";
import { getDeliveryRates, getLocations, getShop, getShopLogoUrl } from "@/features/shops/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { millimesToInput } from "@/lib/utils/price";

export default async function ShopSettingsPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/reglages">) {
  const { shopId } = await params;
  const { role } = await requireShopAccess(shopId);

  const [shop, locations, rates, t] = await Promise.all([
    getShop(shopId),
    getLocations(),
    getDeliveryRates(shopId),
    getTranslations("seller"),
  ]);

  if (!shop) {
    notFound();
  }

  const logoUrl = await getShopLogoUrl(shop.logo_path);
  const editable = role !== "staff" && shop.status !== "suspended";

  if (!editable) {
    return <p className="text-muted-foreground">{t("statusSuspendedHelp")}</p>;
  }

  return (
    <div className="max-w-xl">
      <h2 className="font-display text-xl font-bold">{t("settingsTitle")}</h2>
      <div className="mt-5">
        <LogoUploader shopId={shop.id} shopName={shop.name} logoUrl={logoUrl} />
      </div>
      <div className="mt-6">
        <EditShopForm
          shopId={shop.id}
          locations={locations}
          defaults={{
            name: shop.name,
            description: shop.description ?? "",
            phone: shop.phone?.replace(/^\+216/, "") ?? "",
            governorateId: String(shop.governorate_id),
            cityId: String(shop.city_id),
          }}
        />
      </div>
      <div className="mt-10 border-t pt-6">
        <DeliveryRatesForm
          shopId={shop.id}
          governorates={locations}
          defaultFee={millimesToInput(rates.find((rate) => rate.governorate_id === null)?.fee_millimes)}
          overrides={Object.fromEntries(
            rates.flatMap((rate) =>
              rate.governorate_id === null
                ? []
                : [[String(rate.governorate_id), millimesToInput(rate.fee_millimes)]],
            ),
          )}
        />
      </div>
    </div>
  );
}
