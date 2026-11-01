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
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>

      {items.length ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">{t("warning")}</p>
          <div className="mt-4">
            <CartList items={items} />
          </div>
          <div className="mt-4 flex items-baseline justify-between text-lg font-bold">
            <span>{t("subtotal")}</span>
            <span>{formatPrice(subtotal, locale)}</span>
          </div>
          {purchasable.length ? (
            <Button asChild size="lg" className="mt-4 w-full">
              <Link href="/commande">{t("checkout")}</Link>
            </Button>
          ) : null}
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
