import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ResubmitButton } from "@/features/shops/components/shop-actions";
import { getShop, getShopStats } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { formatPrice } from "@/lib/utils/price";

const HELP = {
  pending: "statusPendingHelp",
  approved: "statusApprovedHelp",
  rejected: "statusRejectedHelp",
  suspended: "statusSuspendedHelp",
  closed: "statusClosedHelp",
} as const;

export default async function ShopOverviewPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]">) {
  const { shopId } = await params;
  const { role } = await requireShopAccess(shopId);

  const [shop, stats, t, seller, locale] = await Promise.all([
    getShop(shopId),
    getShopStats(shopId),
    getTranslations("sellerShop"),
    getTranslations("seller"),
    getLocale(),
  ]);

  if (!shop) {
    notFound();
  }

  const base = `/vendeur/boutique/${shopId}`;
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
      <div className="text-sm leading-relaxed">
        <p>{seller(HELP[shop.status])}</p>
        {shop.review_note ? (
          <p className="mt-1 font-medium">{seller("reviewNote", { note: shop.review_note })}</p>
        ) : null}
      </div>

      {shop.status === "rejected" && role === "owner" ? (
        <div className="mt-4">
          <ResubmitButton shopId={shop.id} />
        </div>
      ) : null}

      <dl className="mt-6 grid grid-cols-2 border-s border-t lg:grid-cols-4">
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

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`${base}/produits/nouveau`}>{t("newProduct")}</Link>
        </Button>
        {shop.status === "approved" ? (
          <Button asChild variant="outline">
            <Link href={`/boutique/${shop.slug}`}>{t("viewShop")}</Link>
          </Button>
        ) : null}
      </div>
    </>
  );
}
