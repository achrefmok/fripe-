"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useTransition } from "react";
import { removeFromCart } from "@/features/orders/actions";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

type CartItem = {
  id: string;
  title: string;
  size: string | null;
  priceMillimes: number;
  status: string;
  purchasable: boolean;
  shopName: string;
  imagePath: string | null;
};

export function CartList({ items }: { items: CartItem[] }) {
  const t = useTranslations("cart");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ul className="divide-y border-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-3 py-3">
          <Link href={`/produit/${item.id}`} className="relative size-20 shrink-0 overflow-hidden bg-secondary">
            {item.imagePath ? (
              <Image src={productImageUrl(item.imagePath)} alt="" fill unoptimized sizes="80px" className="object-cover" />
            ) : null}
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/produit/${item.id}`} className="block truncate font-semibold">{item.title}</Link>
            <p className="truncate text-sm text-muted-foreground">
              {[item.size, item.shopName].filter(Boolean).join(" · ")}
            </p>
            {!item.purchasable ? (
              <p className="text-sm font-medium text-destructive">{t("unavailable")}</p>
            ) : item.status === "reserved" ? (
              <p className="text-sm font-medium">{t("reservedByYou")}</p>
            ) : null}
          </div>
          <div className="text-end">
            <p className="font-semibold">{formatPrice(item.priceMillimes, locale)}</p>
            <button
              type="button"
              disabled={pending}
              className="text-sm underline underline-offset-4"
              onClick={() =>
                startTransition(async () => {
                  await removeFromCart(item.id);
                  router.refresh();
                })
              }
            >
              {t("remove")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
