import { UserRound } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { CardFavorite } from "@/features/catalog/components/card-favorite";
import { DressingHeart } from "@/features/dressing/components/favorites";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import type { Piece } from "./queries";

// La carte unique : la même pour une pièce de boutique et une annonce de particulier. La photo en 4/5,
// le prix agrafé, le cœur, puis le titre, l'état et la taille, et qui vend (boutique ou particulier).
export function PieceCard({ piece, sizes = "(min-width: 1024px) 22vw, 46vw", className }: { piece: Piece; sizes?: string; className?: string }) {
  const t = useTranslations("homePreview");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const details = [piece.condition && conditions(piece.condition), piece.size && t("size", { size: piece.size })].filter(Boolean).join(" · ");

  return (
    <article className={cn("luxe-card card-rise group hp-piece", className)}>
      <div className="relative">
        <Link href={piece.href} className="luxe-card__media">
          {piece.imageUrl ? (
            <Image
              src={piece.imageUrl}
              alt={piece.title}
              fill
              sizes={sizes}
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("noPhoto")}</span>
          )}
          <span className="luxe-price">{formatPrice(piece.priceMillimes, locale)}</span>
          {piece.reserved ? <span className="luxe-card__badge">{t("reserved")}</span> : null}
        </Link>
        <span className="absolute end-2.5 top-2.5">
          {piece.kind === "product" ? <CardFavorite productId={piece.id} title={piece.title} /> : <DressingHeart listingId={piece.id} title={piece.title} />}
        </span>
      </div>
      <Link href={piece.href} tabIndex={-1} className="block">
        <h3 className="mt-2.5 truncate text-sm font-medium" dir="auto">{piece.title}</h3>
        {details ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{details}</p> : null}
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs">
          {piece.pro ? (
            <ShopMark name={piece.sellerName} logoPath={piece.sellerLogoPath} size="xs" />
          ) : (
            <span className="seller-person" aria-hidden="true">
              <UserRound className="size-3" strokeWidth={2.4} />
            </span>
          )}
          <span className="truncate font-medium" dir="auto">
            {piece.pro ? piece.sellerName : `${t("person")} · ${piece.sellerName.split(" ")[0]}`}
          </span>
        </p>
      </Link>
    </article>
  );
}
