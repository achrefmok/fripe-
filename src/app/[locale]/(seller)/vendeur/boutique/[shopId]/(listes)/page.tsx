import { Clapperboard, Package, PackagePlus, Pencil, Phone, Store, Video } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResubmitButton } from "@/features/shops/components/shop-actions";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { getShop, getShopStats } from "@/features/shops/queries";
import { listShopVideos } from "@/features/walk/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

const HELP = {
  pending: "statusPendingHelp",
  approved: "statusApprovedHelp",
  rejected: "statusRejectedHelp",
  suspended: "statusSuspendedHelp",
  closed: "statusClosedHelp",
} as const;

// « Ma boutique » : l'identité de la boutique, les deux gestes du quotidien (ajouter un produit,
// filmer une vidéo) et les chiffres, chacun menant à sa liste.
export default async function ShopOverviewPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]">) {
  const { shopId } = await params;
  const { role } = await requireShopAccess(shopId);

  const [shop, stats, videos, t, seller, locale] = await Promise.all([
    getShop(shopId),
    getShopStats(shopId),
    listShopVideos(shopId),
    getTranslations("sellerShop"),
    getTranslations("seller"),
    getLocale(),
  ]);

  if (!shop) {
    notFound();
  }

  const base = `/vendeur/boutique/${shopId}`;
  const editable = role !== "staff" && shop.status !== "suspended";
  const publishedVideos = videos.filter((video) => video.status === "published").length;
  const figures = [
    { label: t("statPending"), value: stats.pending_orders, href: `${base}/commandes?statut=pending` },
    { label: t("statActive"), value: stats.active_orders, href: `${base}/commandes` },
    { label: t("statRequests"), value: stats.open_requests, href: `${base}/demandes` },
    { label: t("statPublished"), value: stats.published, href: `${base}/produits?onglet=published` },
    { label: t("statDrafts"), value: stats.drafts, href: `${base}/produits` },
    { label: t("statAvailable"), value: stats.available, href: `${base}/produits?onglet=published` },
    { label: t("statReserved"), value: stats.reserved, href: `${base}/commandes` },
    { label: t("statSold"), value: stats.sold, href: `${base}/commandes` },
  ];

  return (
    <>
      <h2 className="sr-only">{t("overview")}</h2>
      <div className="text-sm leading-relaxed">
        <p>{seller(HELP[shop.status])}</p>
        {shop.review_note ? <p className="mt-1 font-medium">{seller("reviewNote", { note: shop.review_note })}</p> : null}
      </div>

      {shop.status === "rejected" && role === "owner" ? (
        <div className="mt-4">
          <ResubmitButton shopId={shop.id} />
        </div>
      ) : null}

      {/* Les deux gestes du quotidien, en grand, à portée de pouce. */}
      <div className="seller-quick mt-6">
        <Link href={`${base}/produits/nouveau`} className="seller-quick__item seller-quick__item--primary">
          <PackagePlus className="size-7" aria-hidden="true" />
          <span>{t("addProduct")}</span>
        </Link>
        <Link href={`${base}/videos/nouvelle`} className="seller-quick__item">
          <Video className="size-7" aria-hidden="true" />
          <span>{t("createVideo")}</span>
        </Link>
      </div>

      <section className="shop-panel mt-6" aria-labelledby="identite">
        <div className="flex items-start gap-4">
          <ShopMark name={shop.name} logoPath={shop.logo_path} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 id="identite" className="font-display text-lg font-bold">{t("identityTitle")}</h3>
            <dl className="mt-2 grid gap-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="sr-only">{t("identityPlace")}</dt>
                <Store className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <dd>
                  {[shop.cities, shop.governorates]
                    .filter((entry): entry is { name_fr: string; name_ar: string } => Boolean(entry))
                    .map((entry) => localizedName(entry, locale))
                    .filter((name, index, names) => names.indexOf(name) === index)
                    .join(", ")}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">{t("identityPhone")}</dt>
                <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <dd dir="ltr">{shop.phone ?? t("identityNoPhone")}</dd>
              </div>
            </dl>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground" dir="auto">
              {shop.description || t("identityNoDescription")}
            </p>
          </div>
        </div>
        {editable ? (
          <Button asChild variant="outline" className="mt-4 h-auto min-h-10 w-full py-2 whitespace-normal sm:w-auto">
            <Link href={`${base}/reglages`}>
              <Pencil aria-hidden="true" />
              {t("editInfo")}
            </Link>
          </Button>
        ) : null}
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link href={`${base}/produits`} className="shop-panel shop-panel--link">
          <Package className="size-6" aria-hidden="true" />
          <span className="font-display text-lg font-bold">{t("myProducts")}</span>
          <span className="text-sm text-muted-foreground">{t("productsSummary", { published: stats.published, drafts: stats.drafts })}</span>
        </Link>
        <Link href={`${base}/videos`} className="shop-panel shop-panel--link">
          <Clapperboard className="size-6" aria-hidden="true" />
          <span className="font-display text-lg font-bold">{t("myVideos")}</span>
          <span className="text-sm text-muted-foreground">{t("videosSummary", { count: publishedVideos })}</span>
        </Link>
      </div>

      <h3 className="mt-8 font-display text-lg font-bold">{t("figuresTitle")}</h3>
      <dl className="mt-3 grid grid-cols-2 border-s border-t lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="border-e border-b">
            <Link href={figure.href} className="block p-4 transition-colors hover:bg-muted">
              <dt className="text-sm text-muted-foreground">{figure.label}</dt>
              <dd className="mt-1 font-display text-3xl font-extrabold tabular-nums">{figure.value}</dd>
            </Link>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-sm text-muted-foreground">
        {t("statRevenue")} : {formatPrice(stats.delivered_revenue_millimes, locale)}
      </p>
    </>
  );
}
