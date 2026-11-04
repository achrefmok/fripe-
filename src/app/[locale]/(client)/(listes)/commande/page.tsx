import { getLocale, getTranslations } from "next-intl/server";
import { CheckoutForm } from "@/features/orders/components/checkout-form";
import { getCart } from "@/features/orders/queries";
import { getLocations } from "@/features/shops/queries";
import { redirect } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function CheckoutPage() {
  const viewer = await requireViewer("/commande");
  const [items, locations, t, locale] = await Promise.all([
    getCart(viewer.id),
    getLocations(),
    getTranslations("checkout"),
    getLocale(),
  ]);

  const purchasable = items.filter((item) => item.purchasable);

  if (!purchasable.length) {
    return redirect({ href: "/panier", locale });
  }

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <div className="mt-6">
        <CheckoutForm
          items={purchasable}
          locations={locations}
          defaults={{
            recipientName: viewer.displayName,
            phone: viewer.phone?.replace(/^\+216/, "") ?? "",
            governorateId: viewer.governorateId ? String(viewer.governorateId) : "",
            cityId: viewer.cityId ? String(viewer.cityId) : "",
            addressLine: viewer.addressLine ?? "",
          }}
        />
      </div>
    </>
  );
}
