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
    { label: t("color"), value: product.color },
    { label: t("condition"), value: product.condition && conditions(product.condition) },
  ].filter((detail) => detail.value);

  const availability = { available: "available", reserved: "reserved", sold: "sold" } as const;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 md:px-6 md:pb-16 md:pt-10">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2 md:gap-10">
        <ProductGallery images={product.product_images} title={title} />

        <div>
          {product.publication_status !== "published" ? (
            <p className="mb-3 bg-secondary px-3 py-2 text-sm font-medium">{t("draftNotice")}</p>
          ) : null}

          <h1 className="font-display text-3xl leading-tight font-extrabold md:text-4xl">{title}</h1>
          <p className="mt-2 font-display text-3xl font-extrabold text-harissa">
            {product.price_millimes ? formatPrice(product.price_millimes, locale) : null}
          </p>
          <p className="mt-1 text-sm font-semibold">{t(availability[product.status])}</p>

          <div className="mt-5">
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
          </div>

          <div className="mt-2 flex flex-wrap">
            <ContactButton
              signedIn={Boolean(viewer)}
              next={`/produit/${product.id}`}
              shopId={product.shops.id}
              productId={product.id}
            />
            {viewer ? <ReportDialog targetType="product" targetId={product.id} /> : null}
          </div>

          <dl className="mt-6 divide-y border-y">
            {details.map((detail) => (
              <div key={detail.label} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted-foreground">{detail.label}</dt>
                <dd className="text-end font-medium">{detail.value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted-foreground">{t("shop")}</dt>
              <dd className="text-end font-medium">
                <Link href={`/boutique/${product.shops.slug}`} className="underline underline-offset-4">
                  {product.shops.name}
                </Link>
                {product.shops.cities ? (
                  <span className="block text-sm font-normal text-muted-foreground">
                    {localizedName(product.shops.cities, locale)}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          {product.description ? (
            <section className="mt-6">
              <h2 className="font-semibold">{t("description")}</h2>
              <p className="mt-1 leading-relaxed whitespace-pre-line text-muted-foreground">
                {product.description}
              </p>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="font-semibold">{t("defects")}</h2>
            <p className="mt-1 leading-relaxed text-muted-foreground">
              {product.defects || t("noDefects")}
            </p>
          </section>

        </div>
      </div>

      {similar.length ? (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-2xl font-extrabold">{t("similar")}</h2>
          <ProductRail products={similar} />
        </section>
      ) : null}
    </div>
  );
}
