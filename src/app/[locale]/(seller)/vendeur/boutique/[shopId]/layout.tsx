import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { StatusTag } from "@/components/layout/status-tag";
import { ShopTabs } from "@/features/shops/components/shop-tabs";
import { getShop } from "@/features/shops/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function SellerShopLayout({
  children,
  params,
}: LayoutProps<"/[locale]/vendeur/boutique/[shopId]">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [shop, t] = await Promise.all([getShop(shopId), getTranslations("sellerShop")]);

  if (!shop) {
    notFound();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold">{shop.name}</h1>
        <StatusTag status={shop.status} />
      </div>
      <ShopTabs
        shopId={shopId}
        labels={{
          overview: t("overview"),
          products: t("products"),
          quick: t("quick"),
          collections: t("collections"),
          stock: t("stock"),
          videos: t("videos"),
          messages: t("messages"),
          orders: t("orders"),
          requests: t("requests"),
          reviews: t("reviews"),
          blocks: t("blocks"),
          settings: t("settings"),
        }}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
