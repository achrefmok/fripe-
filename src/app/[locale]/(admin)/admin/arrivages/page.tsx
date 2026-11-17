import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrivalReviewActions } from "@/features/arrivals/components/arrival-review";
import { listPendingArrivals } from "@/features/catalog/queries";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

export async function generateMetadata() {
  const t = await getTranslations("arrivals");
  return { title: t("adminTitle") };
}

// Les arrivages annoncés par les boutiques : validés, ils passent en tête de l'accueil.
export default async function AdminArrivalsPage() {
  const [arrivals, t, locale] = await Promise.all([listPendingArrivals(), getTranslations("arrivals"), getLocale()]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">{t("adminTitle")}</h1>
        <p className="mt-1 text-muted-foreground">{t("adminLead")}</p>
      </div>

      {arrivals.length ? (
        <ul className="grid gap-4">
          {arrivals.map((arrival) => (
            <li key={arrival.id} className="shop-panel grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ShopMark name={arrival.shop.name} logoPath={arrival.shop.logo_path} size="sm" />
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold" dir="auto">{arrival.title}</p>
                    <p className="text-sm text-muted-foreground">
                      <Link href={`/boutique/${arrival.shop.slug}`} className="underline underline-offset-4">{arrival.shop.name}</Link>
                      {" · "}
                      {formatDateTime(arrival.createdAt, locale)}
                    </p>
                  </div>
                </div>
                <ArrivalReviewActions arrivalId={arrival.id} title={arrival.title} />
              </div>
              {arrival.note ? <p className="text-sm" dir="auto">{arrival.note}</p> : null}
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {arrival.products.map((product) => (
                  <li key={product.id}>
                    <Link href={`/produit/${product.id}`} className="block">
                      <span className="relative block aspect-[3/4] overflow-hidden rounded-[2px] bg-secondary">
                        {product.imagePath ? (
                          <Image src={productImageUrl(product.imagePath)} alt="" fill sizes="8rem" className="object-cover" />
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs" dir="auto">{product.title}</span>
                      <span className="block text-xs tabular-nums text-muted-foreground">{formatPrice(product.priceMillimes, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("adminEmpty")}</p>
      )}
    </div>
  );
}
