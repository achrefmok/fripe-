import { getLocale, getTranslations } from "next-intl/server";
import { CreateShopForm } from "@/features/shops/components/shop-forms";
import { getLocations, getMyShops } from "@/features/shops/queries";
import { redirect } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function CreateShopPage() {
  const viewer = await requireViewer("/vendeur/creer-boutique");
  const owned = (await getMyShops(viewer.id)).find((shop) => shop.role === "owner");

  // Un compte n'a qu'une boutique : on le ramène à la sienne.
  if (owned) {
    return redirect({ href: `/vendeur/boutique/${owned.id}`, locale: await getLocale() });
  }

  const [t, locations] = await Promise.all([getTranslations("seller"), getLocations()]);

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-extrabold">{t("createTitle")}</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">{t("createLead")}</p>
      <p className="mt-2 text-sm font-medium">{t("oneShopNote")}</p>
      <div className="mt-8">
        <CreateShopForm locations={locations} />
      </div>
    </div>
  );
}
