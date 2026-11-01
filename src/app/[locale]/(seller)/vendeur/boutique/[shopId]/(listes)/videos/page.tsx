import { getLocale, getTranslations } from "next-intl/server";
import { listOfferableProducts } from "@/features/catalog/queries";
import { VideoRow } from "@/features/walk/components/video-row";
import { VideoUploader } from "@/features/walk/components/video-uploader";
import { listShopVideos } from "@/features/walk/queries";
import { getShop } from "@/features/shops/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { formatPrice } from "@/lib/utils/price";

export default async function ShopVideosPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/videos">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [videos, products, shop, t, locale] = await Promise.all([
    listShopVideos(shopId),
    listOfferableProducts(shopId),
    getShop(shopId),
    getTranslations("walk"),
    getLocale(),
  ]);

  const options = products.map((product) => ({
    id: product.id,
    label: `${product.title} · ${product.price_millimes ? formatPrice(product.price_millimes, locale) : ""}`,
  }));

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold">{t("sellerTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("sellerLead")}</p>
      </div>

      {shop?.status === "approved" ? (
        <VideoUploader shopId={shopId} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("shopNotApproved")}</p>
      )}

      {videos.length ? (
        <ul className="divide-y border-y">
          {videos.map((video) => (
            <VideoRow key={video.id} shopId={shopId} video={video} products={options} />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("sellerEmpty")}</p>
      )}
    </div>
  );
}
