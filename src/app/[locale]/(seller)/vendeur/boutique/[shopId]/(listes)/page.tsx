import { ArrowRight, Check, Images, PackagePlus, Pencil, Phone, Radio, Store, Video } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OrderStatusTag } from "@/features/orders/components/order-status-tag";
import { listShopOrders } from "@/features/orders/queries";
import { ResubmitButton } from "@/features/shops/components/shop-actions";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { getShop, getShopStats } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { formatDate, localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

const HELP = {
  pending: "statusPendingHelp",
  approved: "statusApprovedHelp",
  rejected: "statusRejectedHelp",
  suspended: "statusSuspendedHelp",
  closed: "statusClosedHelp",
} as const;

// Le tableau de bord : d'abord ce qui attend une réponse, puis les gestes du quotidien, les chiffres
// qui comptent et les dernières commandes. Chaque bloc mène à sa liste.
export default async function ShopOverviewPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]">) {
  const { shopId } = await params;
  const { role } = await requireShopAccess(shopId);

  const [shop, stats, recent, t, seller, locale] = await Promise.all([
    getShop(shopId),
    getShopStats(shopId),
    listShopOrders(shopId, null, 1),
    getTranslations("sellerShop"),
    getTranslations("seller"),
    getLocale(),
  ]);

  if (!shop) {
    notFound();
  }

  const base = `/vendeur/boutique/${shopId}`;
  const editable = role !== "staff" && shop.status !== "suspended";

  const todos = [
    { count: stats.pending_orders, label: t("todoPending", { count: stats.pending_orders }), href: `${base}/commandes?statut=pending` },
    { count: stats.open_requests, label: t("todoRequests", { count: stats.open_requests }), href: `${base}/demandes` },
    { count: stats.drafts, label: t("todoDrafts", { count: stats.drafts }), href: `${base}/produits` },
  ].filter((todo) => todo.count > 0);

  const actions = [
    { href: `${base}/produits/nouveau`, label: t("addProduct"), icon: PackagePlus, primary: true },
    { href: `${base}/videos/nouvelle`, label: t("createVideo"), icon: Video, primary: false },
    { href: `${base}/lives`, label: t("startLive"), icon: Radio, primary: false },
    { href: `${base}/publication-rapide`, label: t("quick"), icon: Images, primary: false },
  ];

  const headline = [
    { label: t("statRevenue"), value: formatPrice(stats.delivered_revenue_millimes, locale), href: `${base}/commandes?statut=delivered` },
    { label: t("statSold"), value: stats.sold, href: `${base}/commandes` },
    { label: t("statPublished"), value: stats.published, href: `${base}/produits?onglet=published` },
    { label: t("statActive"), value: stats.active_orders, href: `${base}/commandes` },
  ];

  const details = [
    { label: t("statAvailable"), value: stats.available, href: `${base}/produits?onglet=published` },
    { label: t("statReserved"), value: stats.reserved, href: `${base}/commandes` },
    { label: t("statDrafts"), value: stats.drafts, href: `${base}/produits` },
    { label: t("statRequests"), value: stats.open_requests, href: `${base}/demandes` },
  ];

  return (
    <div className="seller-dash">
      <h2 className="sr-only">{t("overview")}</h2>

      {shop.status !== "approved" || shop.review_note ? (
        <div className="seller-note">
          <p>{seller(HELP[shop.status])}</p>
          {shop.review_note ? <p className="mt-1 font-medium">{seller("reviewNote", { note: shop.review_note })}</p> : null}
          {shop.status === "rejected" && role === "owner" ? (
            <div className="mt-3">
              <ResubmitButton shopId={shop.id} />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="sr-only">{seller(HELP[shop.status])}</p>
      )}

      <section className="seller-todo" aria-labelledby="a-faire">
        <h3 id="a-faire" className="luxe-kicker">{t("todoTitle")}</h3>
        {todos.length ? (
          <ul className="mt-2 grid gap-2">
            {todos.map((todo) => (
              <li key={todo.href}>
                <Link href={todo.href} className="seller-todo__item">
                  <span className="seller-todo__count">{todo.count}</span>
                  <span className="min-w-0 flex-1">{todo.label}</span>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-goldink">
                    {t("todoGo")}
                    <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 text-goldink" aria-hidden="true" />
            {t("todoNone")}
          </p>
        )}
      </section>

      <section aria-labelledby="actions-rapides">
        <h3 id="actions-rapides" className="luxe-kicker">{t("quickTitle")}</h3>
        <div className="seller-quick mt-2">
          {actions.map(({ href, label, icon: Icon, primary }) => (
            <Link key={href} href={href} className={primary ? "seller-quick__item seller-quick__item--primary" : "seller-quick__item"}>
              <Icon className="size-6" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="chiffres">
        <h3 id="chiffres" className="luxe-kicker">{t("figuresTitle")}</h3>
        <dl className="seller-kpis mt-2">
          {headline.map((figure) => (
            <div key={figure.label}>
              <Link href={figure.href} className="seller-kpi">
                <dt>{figure.label}</dt>
                <dd>{figure.value}</dd>
              </Link>
            </div>
          ))}
        </dl>
        <details className="seller-more">
          <summary>{t("moreFigures")}</summary>
          <dl className="seller-more__list">
            {details.map((figure) => (
              <div key={figure.label}>
                <Link href={figure.href} className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-sm text-muted-foreground">{figure.label}</dt>
                  <dd className="font-display text-xl tabular-nums">{figure.value}</dd>
                </Link>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section aria-labelledby="dernieres-commandes">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="dernieres-commandes" className="luxe-kicker">{t("recentOrders")}</h3>
          {recent.orders.length ? (
            <Link href={`${base}/commandes`} className="text-sm font-medium text-goldink underline underline-offset-4">{t("allOrders")}</Link>
          ) : null}
        </div>
        {recent.orders.length ? (
          <ul className="seller-orders mt-2">
            {recent.orders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <Link href={`${base}/commandes/${order.id}`} className="seller-orders__item">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium" dir="auto">{order.order_groups?.recipient_name ?? order.order_groups?.reference}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(order.created_at, locale)} · {t("orderPieces", { count: order.order_items.length })}
                    </span>
                  </span>
                  <OrderStatusTag status={order.status} />
                  <span className="font-display text-lg tabular-nums">{formatPrice(order.total_millimes, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{t("noOrders")}</p>
        )}
      </section>

      <section className="shop-panel" aria-labelledby="identite">
        <div className="flex items-start gap-4">
          <ShopMark name={shop.name} logoPath={shop.logo_path} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 id="identite" className="font-display text-xl">{t("identityTitle")}</h3>
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
    </div>
  );
}
