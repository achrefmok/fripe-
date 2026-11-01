import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { CloseRequestButton } from "@/features/inventory/components/request-actions";
import { ContactButton } from "@/features/messaging/components/contact-button";
import { listMyRequests } from "@/features/inventory/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { formatDate } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

export default async function MyRequestsPage() {
  const viewer = await requireViewer("/compte/demandes");
  const [requests, t, locale] = await Promise.all([
    listMyRequests(viewer.id),
    getTranslations("requests"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <div className="mt-6">
        {requests.length ? (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-4">
            {requests.map((request) => (
              <li key={request.id} className="border-b pb-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/boutique/${request.shops?.slug}`} className="font-semibold underline underline-offset-4">
                    {request.shops?.name}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {t(`status.${request.status}`)} · {formatDate(request.created_at, locale)}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed [overflow-wrap:anywhere]">{request.message}</p>

                <h2 className="mt-3 text-sm font-semibold">{t("offers")}</h2>
                {request.stock_request_offers.length ? (
                  <ul className="mt-1 grid gap-1">
                    {request.stock_request_offers.map((offer) => (
                      <li key={offer.id} className="flex flex-wrap items-baseline justify-between gap-2 bg-secondary px-3 py-2 text-sm">
                        <span>
                          <span className="font-semibold">{offer.products?.title}</span>
                          {offer.products?.price_millimes
                            ? ` · ${formatPrice(offer.products.price_millimes, locale)}`
                            : ""}
                          {offer.message ? (
                            <span className="block text-muted-foreground">{offer.message}</span>
                          ) : null}
                        </span>
                        <Link href={`/produit/${offer.product_id}`} className="font-medium underline underline-offset-4">
                          {t("viewPiece")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("noOffers")}</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <ContactButton shopId={request.shops?.id} requestId={request.id} />
                  {request.status !== "closed" ? <CloseRequestButton requestId={request.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
      </div>
    </>
  );
}
