import { ArrowLeft, ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { StatusTag } from "@/components/layout/status-tag";
import { Button } from "@/components/ui/button";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { ShopTabs } from "@/features/shops/components/shop-tabs";
import { getShop } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { localizedName } from "@/lib/utils/format";

export default async function SellerShopLayout({
  children,
  params,
}: LayoutProps<"/[locale]/vendeur/boutique/[shopId]">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [shop, t, locale] = await Promise.all([getShop(shopId), getTranslations("sellerShop"), getLocale()]);

  if (!shop) {
    notFound();
  }

  return (
    <>
      <header className="seller-head">
        <ShopMark name={shop.name} logoPath={shop.logo_path} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 font-display text-2xl font-extrabold [overflow-wrap:anywhere] md:text-3xl" dir="auto">{shop.name}</h1>
            <StatusTag status={shop.status} />
          </div>
          {shop.cities ? <p className="text-sm text-muted-foreground">{localizedName(shop.cities, locale)}</p> : null}
        </div>
        <div className="seller-head__actions">
          {shop.status === "approved" ? (
            <Button asChild>
              <Link href={`/boutique/${shop.slug}`}>
                <ExternalLink aria-hidden="true" />
                {t("viewMyShop")}
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("viewMyShopPending")}</p>
          )}
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="rtl:-scale-x-100" aria-hidden="true" />
              {t("backToApp")}
            </Link>
          </Button>
        </div>
      </header>
      <ShopTabs
        shopId={shopId}
        labels={{
          sections: t("sections"),
          myShop: t("myShop"),
          myProducts: t("myProducts"),
          myVideos: t("myVideos"),
          activity: t("activity"),
          products: t("products"),
          quick: t("quick"),
          collections: t("collections"),
          stock: t("stock"),
          messages: t("messages"),
          orders: t("orders"),
          requests: t("requests"),
          reviews: t("reviews"),
          blocks: t("blocks"),
        }}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
