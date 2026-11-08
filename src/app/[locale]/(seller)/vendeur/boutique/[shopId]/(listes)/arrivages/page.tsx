import { getLocale, getTranslations } from "next-intl/server";
import { ArrivalForm, WithdrawArrivalButton } from "@/features/arrivals/components/arrival-form";
import { listArrivalCandidates, listShopArrivals } from "@/features/catalog/queries";
import { getShop } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/format";

const TONE = {
  pending: "bg-secondary text-foreground",
  approved: "bg-foreground text-background",
  rejected: "bg-destructive/10 text-destructive",
} as const;

export async function generateMetadata() {
  const t = await getTranslations("arrivals");
  return { title: t("sellerTitle") };
}

export default async function ShopArrivalsPage({ params }: PageProps<"/[locale]/vendeur/boutique/[shopId]/arrivages">) {
  const { shopId } = await params;
  const { role } = await requireShopAccess(shopId);

  const [shop, arrivals, candidates, t, locale] = await Promise.all([
    getShop(shopId),
    listShopArrivals(shopId),
    listArrivalCandidates(shopId),
    getTranslations("arrivals"),
    getLocale(),
  ]);

  const canSubmit = shop?.status === "approved" && role !== "staff";

  return (
    <div className="grid max-w-3xl gap-8">
      <div>
        <h2 className="font-display text-2xl font-bold">{t("sellerTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("sellerLead")}</p>
      </div>

      {canSubmit ? (
        <section className="shop-panel" aria-labelledby="nouvel-arrivage">
          <h3 id="nouvel-arrivage" className="mb-4 font-display text-lg font-bold">{t("newTitle")}</h3>
          <ArrivalForm shopId={shopId} candidates={candidates} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">{t("notAllowed")}</p>
      )}

      <section aria-labelledby="mes-arrivages">
        <h3 id="mes-arrivages" className="font-display text-lg font-bold">{t("listTitle")}</h3>
        {arrivals.length ? (
          <ul className="mt-3 divide-y border-y">
            {arrivals.map((arrival) => (
              <li key={arrival.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold" dir="auto">{arrival.title}</span>
                    <span className={cn("px-2 py-0.5 text-xs font-semibold", TONE[arrival.status])}>{t(`status.${arrival.status}`)}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatDate(arrival.created_at, locale)} · {t("piecesShort", { count: arrival.arrival_products.length })}
                  </p>
                  {arrival.status === "rejected" && arrival.review_note ? (
                    <p className="mt-1 text-sm">{t("reason", { note: arrival.review_note })}</p>
                  ) : null}
                  {arrival.status === "approved" && shop ? (
                    <Link href={`/boutique/${shop.slug}/arrivage/${arrival.id}`} className="mt-1 inline-block text-sm font-medium underline underline-offset-4">
                      {t("viewPublic")}
                    </Link>
                  ) : null}
                </div>
                {role !== "staff" ? <WithdrawArrivalButton shopId={shopId} arrivalId={arrival.id} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("listEmpty")}</p>
        )}
      </section>
    </div>
  );
}
