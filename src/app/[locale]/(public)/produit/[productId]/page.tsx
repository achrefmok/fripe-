import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ProductActions } from "@/features/catalog/components/product-actions";
import { ContactButton } from "@/features/messaging/components/contact-button";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { ProductGallery } from "@/features/catalog/components/product-gallery";
import { ProductRail } from "@/features/catalog/components/product-card";
import {
  getProduct,
  getReservationTtlMinutes,
  getSimilarProducts,
  getViewerProductState,
} from "@/features/catalog/queries";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";
import { localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import { colorLabel } from "@/features/catalog/product-options";
import { FlipTag } from "@/features/catalog/components/flip-tag";
import { ShopMark } from "@/features/shops/components/shop-mark";

export async function generateMetadata({ params }: PageProps<"/[locale]/produit/[productId]">) {
  const { productId } = await params;
  const product = /^[0-9a-f-]{36}$/i.test(productId) ? await getProduct(productId) : null;
  return { title: product?.title ?? undefined };
}

export default async function ProductPage({ params }: PageProps<"/[locale]/produit/[productId]">) {
  const { productId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(productId)) {
    notFound();
  }

  const product = await getProduct(productId);

  if (!product?.shops) {
    notFound();
  }

  const [viewer, t, conditions, locale, similar, ttlMinutes] = await Promise.all([
    getViewer(),
    getTranslations("product"),
    getTranslations("conditions"),
    getLocale(),
    getSimilarProducts(product),
    getReservationTtlMinutes(),
  ]);

  const state = viewer
    ? await getViewerProductState(product.id, viewer.id)
    : { isFavorite: false, inCart: false, reservation: null };

  const title = product.title ?? "";
  const details = [
    { label: t("size"), value: product.size },
    { label: t("brand"), value: product.brand },
    { label: t("color"), value: colorLabel(product.color, locale) },
    { label: t("condition"), value: product.condition && conditions(product.condition) },
  ].filter((detail) => detail.value);

  const availability = { available: "available", reserved: "reserved", sold: "sold" } as const;
  const city = product.shops.cities ? localizedName(product.shops.cities, locale) : null;
  const category = product.categories;

  return (
    <div className="mx-auto max-w-[1200px] px-[18px] pb-24 pt-3.5 md:pb-12">
      <Link
        href={category ? { pathname: "/catalogue", query: { categorie: category.slug } } : "/catalogue"}
        className="inline-block py-1.5 text-[13px] text-muted-foreground hover:text-harissa"
      >
        <span className="rtl:hidden">← </span>
        {category ? localizedName(category, locale) : t("backToCatalogue")}
        <span className="ltr:hidden"> →</span>
      </Link>

      <div className="mt-2 flex flex-wrap items-start gap-8">
        <div className="lx-gallery">
          <ProductGallery images={product.product_images} title={title} />
          <span className="lx-gallery__unique" aria-hidden="true">✦ {t("uniquePiece")}</span>
        </div>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          {product.publication_status !== "published" ? (
            <p className="rounded-2xl bg-secondary px-3 py-2 text-sm font-medium">{t("draftNotice")}</p>
          ) : null}

          <Link href={`/boutique/${product.shops.slug}`} className="flex items-center gap-2.5 self-start">
            <ShopMark name={product.shops.name} logoPath={product.shops.logo_path} size="md" />
            <span className="flex flex-col">
              <span className="font-medium" dir="auto">{product.shops.name}</span>
              <span className="text-xs text-muted-foreground">
                {city ? `${city} · ` : ""}
                {t("verifiedShop")}
              </span>
            </span>
          </Link>

          <h1 className="font-display text-[clamp(32px,4vw,46px)] leading-[1.05]" dir="auto">{title}</h1>
          <p className="font-display text-[30px] leading-none text-goldink">
            {product.price_millimes ? formatPrice(product.price_millimes, locale) : null}
          </p>
          <p className="text-sm font-medium">{t(availability[product.status])}</p>

          <FlipTag
            specs={details.map((detail) => ({ label: detail.label, value: String(detail.value) }))}
            defectsTitle={t("defects")}
            defects={product.defects || t("noDefects")}
            reference={null}
            flipLabel={t("flipTag")}
            backLabel={t("flipBack")}
          />

          <ProductActions
            productId={product.id}
            title={title}
            status={product.status}
            signedIn={Boolean(viewer)}
            isFavorite={state.isFavorite}
            inCart={state.inCart}
            reservation={state.reservation}
            ttlMinutes={ttlMinutes}
          />

          <dl className="flex flex-col border-t">
            <div className="flex justify-between gap-3 border-b py-3 text-sm">
              <dt className="text-muted-foreground">{t("deliveryLabel")}</dt>
              <dd className="text-end">{t("deliveryLine")}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b py-3 text-sm">
              <dt className="text-muted-foreground">{t("pickupLabel")}</dt>
              <dd className="text-end">{city ? t("pickupLine", { city }) : t("pickupShop")}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 text-sm">
              <dt className="text-muted-foreground">{t("question")}</dt>
              <dd className="flex flex-wrap justify-end">
                <ContactButton signedIn={Boolean(viewer)} next={`/produit/${product.id}`} shopId={product.shops.id} productId={product.id} />
                {viewer ? <ReportDialog targetType="product" targetId={product.id} /> : null}
              </dd>
            </div>
          </dl>

          {product.description ? (
            <section>
              <h2 className="font-display text-xl">{t("description")}</h2>
              <p className="mt-1 leading-relaxed whitespace-pre-line text-muted-foreground" dir="auto">{product.description}</p>
            </section>
          ) : null}
        </div>
      </div>

      {similar.length ? (
        <section className="mt-11">
          <h2 className="mb-3.5 font-display text-[clamp(22px,3vw,30px)]">{t("similar")}</h2>
          <ProductRail products={similar} />
        </section>
      ) : null}
    </div>
  );
}
