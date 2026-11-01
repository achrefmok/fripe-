import { getLocale, getTranslations } from "next-intl/server";
import { getCategories } from "@/features/catalog/queries";
import { AddStockForm, StockRow } from "@/features/inventory/components/stock-manager";
import { listInventory } from "@/features/inventory/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { formatDate, localizedName } from "@/lib/utils/format";

export default async function ShopStockPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/stock">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [items, categories, t, locale] = await Promise.all([
    listInventory(shopId),
    getCategories(),
    getTranslations("sellerShop"),
    getLocale(),
  ]);

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h2 className="font-display text-2xl font-bold">{t("stockTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("stockLead")}</p>
      </div>

      {items.length ? (
        <ul className="divide-y border-y">
          {items.map((item) => (
            <StockRow
              key={item.id}
              shopId={shopId}
              id={item.id}
              name={`${item.categories ? localizedName(item.categories, locale) : ""}${item.label ? ` · ${item.label}` : ""}`}
              quantity={item.approx_quantity}
              visible={item.is_visible}
              countedAt={formatDate(item.last_counted_at, locale)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("stockEmpty")}</p>
      )}

      <AddStockForm
        shopId={shopId}
        categories={categories.map((category) => ({
          id: category.id,
          name: locale === "ar" ? category.nameAr : category.nameFr,
        }))}
      />
    </div>
  );
}
