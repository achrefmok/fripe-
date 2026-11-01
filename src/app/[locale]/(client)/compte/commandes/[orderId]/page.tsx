import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CancelOrderButton } from "@/features/orders/components/order-actions";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getOrder } from "@/features/orders/queries";
import { RatingStars } from "@/features/reviews/components/rating-stars";
import { ReviewForm } from "@/features/reviews/components/review-form";
import { getMyReviews } from "@/features/reviews/queries";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function MyOrderPage({
  params,
}: PageProps<"/[locale]/compte/commandes/[orderId]">) {
  const { orderId } = await params;
  const viewer = await requireViewer(`/compte/commandes/${orderId}`);

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    notFound();
  }

  const order = await getOrder(orderId);

  if (!order || order.client_id !== viewer.id) {
    notFound();
  }

  const delivered = order.status === "delivered";

  const [reviews, t] = await Promise.all([
    delivered ? getMyReviews(order.order_items.map((item) => item.id)) : new Map(),
    getTranslations("reviews"),
  ]);

  return (
    <>
      <OrderDetail order={order} />
      {order.status === "pending" ? (
        <div className="mt-6">
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}

      {delivered ? (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">{t("yourReviews")}</h2>
          <ul className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            {order.order_items.map((item) => {
              const review = reviews.get(item.id);

              return (
                <li key={item.id}>
                  {review ? (
                    <div className="grid gap-1 border-b pb-3">
                      <p className="font-semibold">{item.title}</p>
                      <RatingStars rating={review.rating ?? 0} />
                      {review.comment ? <p className="leading-relaxed">{review.comment}</p> : null}
                      {review.status === "hidden" ? (
                        <p className="text-sm text-muted-foreground">{t("hiddenNotice")}</p>
                      ) : null}
                    </div>
                  ) : (
                    <ReviewForm orderItemId={item.id} title={item.title} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
