import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getDeliveryPriceList } from "@/features/orders/queries";
import { LogoUploader } from "@/features/shops/components/shop-actions";
import { EditShopForm } from "@/features/shops/components/shop-forms";
import { ShopLocationForm } from "@/features/shops/components/shop-location-form";
import { getLocations, getShop, getShopLocation, getShopLogoUrl } from "@/features/shops/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { getLocale } from "next-intl/server";
import { formatPrice } from "@/lib/utils/price";

export default async function ShopSettingsPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/reglages">) {
  const { shopId } = await params;
  const { role } = await requireShopAccess(shopId);

  const [shop, locations, prices, t, delivery, locale, place, where] = await Promise.all([
    getShop(shopId),
    getLocations(),
    getDeliveryPriceList(),
    getTranslations("seller"),
    getTranslations("delivery"),
    getLocale(),
    getShopLocation(shopId),
    getTranslations("shopLocation"),
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
      {/* Où se trouve la boutique : l'adresse et la position GPS qui guident les clients jusqu'à elle. */}
      <section className="mt-10 border-t pt-6">
        <h3 className="font-display text-lg font-bold">{where("sellerTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{where("sellerLead")}</p>
        <div className="mt-4">
          <ShopLocationForm
            shopId={shop.id}
            locations={locations}
            saved={Boolean(place)}
            defaults={{
              addressLine: place?.addressLine ?? "",
              governorateId: String(place?.governorateId ?? shop.governorate_id),
              cityId: String(place?.cityId ?? shop.city_id),
              latitude: place?.coordinates ? String(place.coordinates.latitude) : "",
              longitude: place?.coordinates ? String(place.coordinates.longitude) : "",
            }}
          />
        </div>
      </section>
      {/* Les frais de livraison sont fixés par FRIPE : la boutique les voit, ne les règle plus. */}
      <section className="mt-10 border-t pt-6">
        <h3 className="font-display text-lg font-bold">{delivery("shopTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{delivery("shopLead")}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 text-sm sm:grid-cols-3">
          {prices.map((price) => {
            const governorate = locations.find((location) => location.id === price.governorate_id);
            return governorate ? (
              <div key={price.governorate_id} className="flex justify-between gap-2 border-b py-1.5">
                <dt className="truncate text-muted-foreground">{locale === "ar" ? governorate.nameAr : governorate.nameFr}</dt>
                <dd className="shrink-0 font-medium">{formatPrice(price.fee_millimes, locale)}</dd>
              </div>
            ) : null;
          })}
        </dl>
      </section>
    </div>
  );
}
