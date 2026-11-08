import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/features/catalog/components/product-card";
import { getPublicArrival } from "@/features/catalog/queries";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils/format";

export async function generateMetadata({ params }: PageProps<"/[locale]/boutique/[slug]/arrivage/[arrivalId]">) {
  const { arrivalId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(arrivalId)) return {};
  const arrival = await getPublicArrival(arrivalId);
  return arrival ? { title: `${arrival.title} · ${arrival.shop.name}` } : {};
}

// Un arrivage validé : ses pièces encore disponibles, avec la boutique qui l'annonce.
export default async function PublicArrivalPage({ params }: PageProps<"/[locale]/boutique/[slug]/arrivage/[arrivalId]">) {
  const { slug, arrivalId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(arrivalId)) {
    notFound();
  }

  const arrival = await getPublicArrival(arrivalId);
  if (!arrival || arrival.shop.slug !== slug) {
    notFound();
  }

  const [t, shop, locale] = await Promise.all([getTranslations("arrivals"), getTranslations("shopPublic"), getLocale()]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 md:px-6 md:pb-16 md:pt-10">
      <Link href={`/boutique/${slug}`} className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4">
        <ShopMark name={arrival.shop.name} logoPath={arrival.shop.logo_path} size="xs" />
        {shop("backToShop", { shop: arrival.shop.name })}
      </Link>
      <p className="mt-4 text-sm font-semibold text-harissa">{t("badge")}</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold text-balance" dir="auto">{arrival.title}</h1>
      {arrival.reviewedAt ? <p className="mt-1 text-sm text-muted-foreground">{formatDate(arrival.reviewedAt, locale)}</p> : null}
      {arrival.note ? <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground" dir="auto">{arrival.note}</p> : null}

      <div className="mt-6">
        {arrival.products.length ? (
          <ProductGrid products={arrival.products} />
        ) : (
          <p className="text-muted-foreground">{t("allGone")}</p>
        )}
      </div>
    </div>
  );
}
