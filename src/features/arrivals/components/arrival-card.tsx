import Image from "next/image";
import type { ArrivalData } from "@/features/catalog/queries";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { productImageUrl } from "@/lib/utils/storage";

// Friptex Luxe : un arrivage validé, en grande photo 4/5, le nombre de pièces sur une pastille
// terre cuite inclinée, puis le médaillon de la boutique, son nom et la date.
export function ArrivalCard({ arrival, piecesLabel, dateLabel }: { arrival: ArrivalData; piecesLabel: string; dateLabel: string | null }) {
  const cover = arrival.products.find((product) => product.imagePath)?.imagePath ?? null;

  return (
    <Link href={`/boutique/${arrival.shop.slug}/arrivage/${arrival.id}`} className="lx-arrival group">
      <span className="lx-arrival__photo">
        {cover ? (
          <Image src={productImageUrl(cover)} alt="" fill sizes="(min-width: 768px) 17rem, 78vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : null}
        <span className="lx-arrival__count">{piecesLabel}</span>
      </span>
      <span className="flex items-center gap-2.5">
        <ShopMark name={arrival.shop.name} logoPath={arrival.shop.logo_path} size="sm" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium" dir="auto">{arrival.title}</span>
          <span className="truncate text-xs text-muted-foreground" dir="auto">
            {arrival.shop.name}
            {dateLabel ? ` · ${dateLabel}` : ""}
          </span>
        </span>
      </span>
    </Link>
  );
}
