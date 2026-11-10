import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { CartList } from "@/features/orders/components/cart-list";
import { getCart } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { formatPrice } from "@/lib/utils/price";

export async function generateMetadata() {
  const t = await getTranslations("cart");
  return { title: t("title") };
}

export default async function CartPage() {
  const viewer = await requireViewer("/panier");
  const [items, t, locale] = await Promise.all([
    getCart(viewer.id),
    getTranslations("cart"),
    getLocale(),
  ]);

  const purchasable = items.filter((item) => item.purchasable);
  const subtotal = purchasable.reduce((sum, item) => sum + item.priceMillimes, 0);

  return (
    <>
      <h1 className="font-display text-[clamp(34px,5vw,54px)] font-normal">{t.rich("titleRich", { em: (chunks) => <em>{chunks}</em> })}</h1>

      {items.length ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{t("warning")}</p>
          <div className="mt-4">
            <CartList items={items} />
          </div>
          {/* Le récapitulatif à l'encre : le total en or, le paiement à la livraison. */}
          <aside className="lx-summary mt-5">
            <span className="font-display text-2xl">{t("summary")}</span>
            <span className="flex justify-between border-t border-current/30 pt-3 text-sm opacity-85">
              <span>{t("payment")}</span>
              <span>{t("paymentOnDelivery")}</span>
            </span>
            <span className="flex items-baseline justify-between">
              <span className="text-sm">{t("subtotal")}</span>
              <span className="font-display text-[30px] text-gold">{formatPrice(subtotal, locale)}</span>
            </span>
            {purchasable.length ? (
              <Link href="/commande" className="lx-summary__go">{t("checkout")}</Link>
            ) : null}
          </aside>
        </>
      ) : (
        <div className="mt-6">
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")}>
            <Button asChild>
              <Link href="/catalogue">{t("browse")}</Link>
            </Button>
          </EmptyState>
        </div>
      )}
    </>
  );
}
