import Image from "next/image";
import type { ArrivalData } from "@/features/catalog/queries";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { productImageUrl } from "@/lib/utils/storage";

// Un arrivage validé : la boutique, le titre, puis ses premières pièces en planche contact.
export function ArrivalCard({ arrival, piecesLabel, dateLabel }: { arrival: ArrivalData; piecesLabel: string; dateLabel: string | null }) {
  const shown = arrival.products.slice(0, 4);

  return (
    <Link href={`/boutique/${arrival.shop.slug}/arrivage/${arrival.id}`} className="arrival-card">
      <span className="arrival-card__head">
        <ShopMark name={arrival.shop.name} logoPath={arrival.shop.logo_path} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" dir="auto">{arrival.shop.name}</span>
          {dateLabel ? <span className="block text-xs text-muted-foreground">{dateLabel}</span> : null}
        </span>
      </span>
      <span className="arrival-card__title" dir="auto">{arrival.title}</span>
      <span className="arrival-card__sheet" aria-hidden="true">
        {shown.map((product) => (
          <span key={product.id} className="arrival-card__photo">
            {product.imagePath ? (
              <Image src={productImageUrl(product.imagePath)} alt="" fill unoptimized sizes="(min-width: 768px) 8rem, 24vw" className="object-cover" />
            ) : null}
          </span>
        ))}
      </span>
      <span className="text-sm font-semibold tabular-nums">{piecesLabel}</span>
    </Link>
  );
}
