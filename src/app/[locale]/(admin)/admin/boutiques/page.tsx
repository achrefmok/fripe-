import { getLocale, getTranslations } from "next-intl/server";
import { StatusTag } from "@/components/layout/status-tag";
import { Pagination } from "@/features/admin/components/pagination";
import { ShopReviewActions } from "@/features/admin/components/admin-actions";
import { EmergencyTakedownButton } from "@/features/admin/components/market-actions";
import { ADMIN_PAGE_SIZE, listShops } from "@/features/admin/queries";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { formatDate, localizedName } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const STATUSES = ["pending", "approved", "rejected", "suspended"] as const;

export default async function AdminShopsPage({
  searchParams,
}: PageProps<"/[locale]/admin/boutiques">) {
  await requireAdmin("/admin/boutiques");
  const { statut, page } = await searchParams;

  const status = STATUSES.find((value) => value === statut) ?? null;
  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ shops, total }, t, statusLabel, locale] = await Promise.all([
    listShops(status, currentPage),
    getTranslations("admin"),
    getTranslations("status"),
    getLocale(),
  ]);

  const filters = [
    { value: null, label: t("filterAll") },
    ...STATUSES.map((value) => ({ value, label: statusLabel(value) })),
  ];

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("shopsTitle")}</h1>

      <nav aria-label={t("colStatus")} className="rail-scroll mt-5 flex gap-1 overflow-x-auto">
        {filters.map((filter) => (
          <Link
            key={filter.label}
            href={filter.value ? `/admin/boutiques?statut=${filter.value}` : "/admin/boutiques"}
            aria-current={filter.value === status ? "true" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center px-3 text-sm font-medium",
              filter.value === status
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {shops.length ? (
        <ul className="mt-5 divide-y border-y">
          {shops.map((shop) => (
            <li key={shop.id} className="grid gap-2 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{shop.name}</p>
                  <StatusTag status={shop.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {shop.cities && localizedName(shop.cities, locale)}
                  {shop.governorates && `, ${localizedName(shop.governorates, locale)}`} ·{" "}
                  {formatDate(shop.created_at, locale)}
                </p>
                {shop.review_note ? (
                  <p className="mt-1 text-sm">{shop.review_note}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <ShopReviewActions shopId={shop.id} shopName={shop.name} status={shop.status} />
                <EmergencyTakedownButton shopId={shop.id} name={shop.name} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-muted-foreground">{t("shopsEmpty")}</p>
      )}

      <Pagination
        page={currentPage}
        total={total}
        pageSize={ADMIN_PAGE_SIZE}
        basePath="/admin/boutiques"
        params={status ? { statut: status } : {}}
      />
    </>
  );
}
