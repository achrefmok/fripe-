import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { listOfferableProducts } from "@/features/catalog/queries";
import { getShop } from "@/features/shops/queries";
import { VideoStudio } from "@/features/walk/studio/video-studio";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";

export async function generateMetadata() {
  const t = await getTranslations("studio");
  return { title: t("title") };
}

export default async function NewVideoPage({ params }: PageProps<"/[locale]/vendeur/boutique/[shopId]/videos/nouvelle">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [shop, products, t, walk] = await Promise.all([
    getShop(shopId),
    listOfferableProducts(shopId),
    getTranslations("studio"),
    getTranslations("walk"),
  ]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <Link href={`/vendeur/boutique/${shopId}/videos`} className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          {t("backToVideos")}
        </Link>
      </div>
      {shop?.status === "approved" ? (
        <VideoStudio
          shopId={shopId}
          products={products.map((product) => ({ id: product.id, title: product.title ?? "", priceMillimes: product.price_millimes }))}
        />
      ) : (
        <p className="text-muted-foreground">{walk("shopNotApproved")}</p>
      )}
    </div>
  );
}
