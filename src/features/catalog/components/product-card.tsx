import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { ProductCardData } from "@/features/catalog/queries";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";
import { CardFavorite } from "./card-favorite";

// Friptex Luxe : la photo en 4/5 aux coins doux, l'étiquette de prix percée d'un œillet d'or,
// le cœur posé sur la photo, puis le titre, la taille et la boutique.
export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  const t = useTranslations("product");
  const locale = useLocale();
  const meta = [product.brand, product.size && t("sizeShort", { size: product.size })].filter(Boolean).join(" · ") || t("unique");

  return (
    <article className={cn("luxe-card card-rise group", className)}>
      <div className="relative">
        <Link href={`/produit/${product.id}`} className="luxe-card__media">
          {product.imagePath ? (
            <Image
              src={productImageUrl(product.imagePath)}
              alt={product.title}
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("noPhoto")}</span>
          )}
          <span className="luxe-price">{formatPrice(product.priceMillimes, locale)}</span>
          {product.status === "reserved" ? <span className="luxe-card__badge">{t("reserved")}</span> : null}
        </Link>
        <CardFavorite productId={product.id} title={product.title} className="absolute end-2.5 top-2.5" />
      </div>
      <Link href={`/produit/${product.id}`} tabIndex={-1} className="block">
        <h3 className="mt-2.5 truncate text-sm font-medium" dir="auto">{product.title}</h3>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ShopMark name={product.shopName} logoPath={product.shopLogoPath} size="xs" />
          <span className="truncate">{meta} · {product.shopName}</span>
        </p>
      </Link>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="luxe-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductRail({ products }: { products: ProductCardData[] }) {
  return (
    <div className="rail-scroll -mx-[18px] flex gap-3 overflow-x-auto px-[18px] md:mx-0 md:px-0">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} className="w-40 shrink-0 snap-start md:w-52" />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="luxe-grid">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <div className="aspect-[4/5] animate-pulse rounded-[18px] bg-muted" />
          <div className="mt-2 h-4 w-3/4 animate-pulse bg-muted" />
          <div className="mt-1 h-4 w-1/2 animate-pulse bg-muted" />
        </div>
      ))}
    </div>
  );
}
