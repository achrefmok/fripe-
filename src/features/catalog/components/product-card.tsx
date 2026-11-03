import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { ProductCardData } from "@/features/catalog/queries";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

export function ProductCard({ product, className }: { product: ProductCardData; className?: string }) {
  const t = useTranslations("product");
  const locale = useLocale();

  return (
    <article className={cn("card-rise group min-w-0", className)}>
      <Link href={`/produit/${product.id}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
          {product.imagePath ? (
            <Image
              src={productImageUrl(product.imagePath)}
              alt={product.title}
              fill
              unoptimized
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("noPhoto")}
            </span>
          )}
          <span className="price-tag absolute bottom-2 start-0">
            {formatPrice(product.priceMillimes, locale)}
          </span>
          {product.status === "reserved" ? (
            <span className="absolute end-2 top-2 bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
              {t("reserved")}
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 truncate text-sm font-semibold">{product.title}</h3>
        {product.brand || product.size ? (
          <p className="truncate text-sm text-muted-foreground">{[product.brand, product.size].filter(Boolean).join(" · ")}</p>
        ) : null}
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          <ShopMark name={product.shopName} logoPath={product.shopLogoPath} size="xs" />
          <span className="truncate">{product.shopName}</span>
        </p>
      </Link>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductRail({ products }: { products: ProductCardData[] }) {
  return (
    <div className="rail-scroll -mx-4 flex gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} className="w-40 shrink-0 snap-start md:w-52" />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <div className="aspect-[3/4] animate-pulse bg-muted" />
          <div className="mt-2 h-4 w-3/4 animate-pulse bg-muted" />
          <div className="mt-1 h-4 w-1/2 animate-pulse bg-muted" />
        </div>
      ))}
    </div>
  );
}
