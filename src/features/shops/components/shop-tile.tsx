import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { productImageUrl, shopAssetUrl } from "@/lib/utils/storage";
import { ShopMark } from "./shop-mark";

// La vitrine d'une boutique : ses trois dernières pièces, ou sa couverture, sous son étiquette.
// Partagée par l'accueil et l'annuaire des boutiques.
export function ShopTile({
  name,
  slug,
  logoPath,
  coverPath,
  previews,
  place,
  pieces,
  description,
  emptyLabel,
  className,
}: {
  name: string;
  slug: string;
  logoPath: string | null;
  coverPath?: string | null;
  previews: string[];
  place: string;
  pieces: string;
  description?: string | null;
  // Affiché dans la vitrine d'une boutique sans pièce ni couverture.
  emptyLabel?: string;
  className?: string;
}) {
  return (
    <Link href={`/boutique/${slug}`} className={cn("shop-tile", className)}>
      <span className="shop-tile__window" aria-hidden="true" data-empty={!previews.length && !coverPath ? "" : undefined}>
        {!previews.length && coverPath ? (
          <span className="shop-tile__photo shop-tile__photo--cover">
            <Image src={shopAssetUrl(coverPath)} alt="" fill unoptimized sizes="(min-width: 1024px) 26rem, 90vw" className="object-cover" />
          </span>
        ) : (
          [0, 1, 2].map((slot) => (
            <span key={slot} className="shop-tile__photo">
              {previews[slot] ? (
                <Image src={productImageUrl(previews[slot])} alt="" fill unoptimized sizes="(min-width: 1024px) 9rem, 30vw" className="object-cover" />
              ) : null}
            </span>
          ))
        )}
        {!previews.length && !coverPath && emptyLabel ? <span className="shop-tile__empty">{emptyLabel}</span> : null}
      </span>
      <span className="shop-tile__label">
        <ShopMark name={name} logoPath={logoPath} size="lg" className="shop-tile__mark" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-xl font-bold" dir="auto">{name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {place} · <span className="tabular-nums">{pieces}</span>
          </span>
        </span>
        <ArrowRight className="shop-tile__arrow size-5 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
      </span>
      {description ? <span className="shop-tile__description" dir="auto">{description}</span> : null}
    </Link>
  );
}
