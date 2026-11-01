import { getTranslations } from "next-intl/server";
import { CreateShopForm } from "@/features/shops/components/shop-forms";
import { getLocations } from "@/features/shops/queries";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function CreateShopPage() {
  await requireViewer("/vendeur/creer-boutique");
  const [t, locations] = await Promise.all([getTranslations("seller"), getLocations()]);

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-extrabold">{t("createTitle")}</h1>
      <p className="mt-2 leading-relaxed text-muted-foreground">{t("createLead")}</p>
      <div className="mt-8">
        <CreateShopForm locations={locations} />
      </div>
    </div>
  );
}
