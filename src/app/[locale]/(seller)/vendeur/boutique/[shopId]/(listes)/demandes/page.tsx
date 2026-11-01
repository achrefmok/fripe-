import { getLocale, getTranslations } from "next-intl/server";
import { listOfferableProducts } from "@/features/catalog/queries";
import { BlockClientButton } from "@/features/messaging/components/block-buttons";
import { ContactButton } from "@/features/messaging/components/contact-button";
import { listShopBlockedClients } from "@/features/messaging/queries";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { CloseRequestButton, OfferForm } from "@/features/inventory/components/request-actions";
import { listShopRequests } from "@/features/inventory/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { formatDate, localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

export default async function ShopRequestsPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/demandes">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [requests, products, t, labels, locale, messaging, blocks] = await Promise.all([
    listShopRequests(shopId),
    listOfferableProducts(shopId),
    getTranslations("sellerShop"),
    getTranslations("requests"),
    getLocale(),
    getTranslations("messaging"),
    listShopBlockedClients(shopId),
  ]);

  const blocked = new Set(blocks.map((block) => block.client_id));

  if (!requests.length) {
    return <p className="text-muted-foreground">{t("requestsEmpty")}</p>;
  }

  const options = products.map((product) => ({
    id: product.id,
    label: `${product.title} · ${product.price_millimes ? formatPrice(product.price_millimes, locale) : ""} · ${product.reference}`,
  }));

  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] max-w-2xl gap-4">
      {requests.map((request) => (
        <li key={request.id} className="border-b pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">{t("requestFrom", { name: request.client_name })}</p>
            <p className="text-sm text-muted-foreground">
              {labels(`status.${request.status}`)} · {formatDate(request.created_at, locale)}
            </p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              request.categories && localizedName(request.categories, locale),
              request.size,
              request.color,
              request.brand,
              request.budget_millimes &&
                labels("budgetValue", { amount: formatPrice(request.budget_millimes, locale) }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-2 leading-relaxed [overflow-wrap:anywhere]">{request.message}</p>
          <div className="flex flex-wrap items-center gap-1">
            {request.client_id ? (
              <>
                {blocked.has(request.client_id) ? null : (
                  <ContactButton
                    label={messaging("contactClient")}
                    requestId={request.id}
                    sellerShopId={shopId}
                  />
                )}
                <BlockClientButton shopId={shopId} clientId={request.client_id} blocked={blocked.has(request.client_id)} />
                <ReportDialog targetType="account" targetId={request.client_id} label={messaging("reportClient")} />
              </>
            ) : null}
          </div>

          {request.stock_request_offers.length ? (
            <p className="mt-2 text-sm">
              {t("offersSent")} :{" "}
              {request.stock_request_offers.map((offer) => offer.products?.title).join(", ")}
            </p>
          ) : null}

          {request.status !== "closed" ? (
            <div className="mt-3 grid gap-3">
              {options.length ? (
                <OfferForm shopId={shopId} requestId={request.id} products={options} />
              ) : (
                <p className="text-sm text-muted-foreground">{t("offerNone")}</p>
              )}
              <CloseRequestButton requestId={request.id} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
