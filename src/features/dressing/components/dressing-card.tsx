import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import type { DressingItem } from "../queries";
import { dressingFirstName, dressingMonogram, dressingTone } from "../tone";
import { DressingHeart } from "./favorites";

// Une pièce du Vide-Dressing : la photo d'abord, la marque en tête, la taille et l'état lisibles
// d'un coup d'œil, puis la personne qui la vend, dans la teinte de son dressing.
export function DressingCard({ item, index = 0, showSeller = true, className }: { item: DressingItem; index?: number; showSeller?: boolean; className?: string }) {
  const t = useTranslations("dressing");
  const market = useTranslations("market");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const tone = dressingTone(item.sellerId);
  const fine = item.condition === "new_with_tags" || item.condition === "like_new";

  return (
    <article className={cn("vd-card", className)} style={{ "--i": index % 8 } as CSSProperties}>
      <div className="vd-card__media">
        <Link href={`/annonce/${item.id}`} className="vd-card__link" aria-label={`${item.brand ? `${item.brand} · ` : ""}${item.title} · ${formatPrice(item.priceMillimes, locale)}`}>
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt="" fill unoptimized sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw" className="vd-card__photo" />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-muted-foreground">{market("noPhoto")}</span>
          )}
        </Link>
        <span className={cn("vd-card__state", fine && "vd-card__state--fine")}>{conditions(item.condition)}</span>
        {item.reserved ? <span className="vd-card__reserved">{market("reserved")}</span> : null}
        <DressingHeart listingId={item.id} title={item.title} />
      </div>
      <div className="vd-card__body">
        <p className="vd-card__brand" dir="auto">{item.brand ?? t("noBrand")}</p>
        <h3 className="vd-card__title" dir="auto">{item.title}</h3>
        <p className="vd-card__meta">
          <span className="vd-card__price">{formatPrice(item.priceMillimes, locale)}</span>
          {item.size ? <span className="vd-card__size" dir="ltr">{t("sizeShort", { size: item.size })}</span> : null}
        </p>
        {showSeller ? (
          <Link href={`/vide-dressing/dressing/${item.sellerId}`} className="vd-card__seller" aria-label={t("dressingOf", { name: dressingFirstName(item.sellerName) })}>
            <span className="vd-avatar vd-avatar--xs" style={{ background: tone.surface, color: tone.ink }} aria-hidden="true">
              {dressingMonogram(item.sellerName)}
            </span>
            <span className="truncate" dir="auto">{dressingFirstName(item.sellerName)}</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function DressingGrid({ items, showSeller = true }: { items: DressingItem[]; showSeller?: boolean }) {
  return (
    <div className="vd-grid">
      {items.map((item, index) => (
        <DressingCard key={item.id} item={item} index={index} showSeller={showSeller} />
      ))}
    </div>
  );
}

export function DressingRail({ items, label }: { items: DressingItem[]; label: string }) {
  return (
    <ul className="vd-rail rail-scroll" aria-label={label}>
      {items.map((item, index) => (
        <li key={item.id}>
          <DressingCard item={item} index={index} />
        </li>
      ))}
    </ul>
  );
}
