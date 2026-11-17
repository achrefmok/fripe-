import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { productImageUrl, shopAssetUrl } from "@/lib/utils/storage";
import { ShopMark } from "./shop-mark";

// Friptex Luxe : une boutique en mosaïque de trois photos (la grande à gauche), son médaillon,
// son nom, sa ville et ses pièces.
export function ShopCard({
  name,
  slug,
  logoPath,
  coverPath,
  previews,
  meta,
  description,
  className,
}: {
  name: string;
  slug: string;
  logoPath: string | null;
  coverPath?: string | null;
  previews: string[];
  meta: string;
  description?: string | null;
  className?: string;
}) {
  const photos = previews.length ? previews.slice(0, 3).map(productImageUrl) : coverPath ? [shopAssetUrl(coverPath)] : [];

  return (
    <Link href={`/boutique/${slug}`} className={cn("lx-shop", className)}>
      <span className="lx-shop__mosaic" aria-hidden="true" data-count={photos.length}>
        {[0, 1, 2].map((slot) => (
          <span key={slot} className="lx-shop__photo">
            {photos[slot] ? <Image src={photos[slot]} alt="" fill sizes="(min-width: 768px) 20rem, 80vw" className="object-cover" /> : null}
          </span>
        ))}
      </span>
      <span className="flex items-center gap-2.5 px-1 pb-1">
        <ShopMark name={name} logoPath={logoPath} size="md" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-medium" dir="auto">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
          {description ? <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground" dir="auto">{description}</span> : null}
        </span>
        <ArrowRight className="size-4 shrink-0 text-goldink rtl:-scale-x-100" aria-hidden="true" />
      </span>
    </Link>
  );
}
