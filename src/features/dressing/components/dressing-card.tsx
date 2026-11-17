import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import type { DressingItem } from "../queries";
import { dressingFirstName, dressingMonogram, dressingTone } from "../tone";
import { DressingHeart } from "./favorites";
import { Hanger } from "./hanger";

// Sans photo, la pièce garde sa place : la matière de son dressing, rayée, et un cintre.
export function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <span className="vd-placeholder">
      <Hanger className="vd-placeholder__hanger" />
      <span className="vd-placeholder__label">{label}</span>
    </span>
  );
}

// Une pièce du Vide-Dressing : la photo d'abord, la marque en tête, la taille et l'état lisibles
// d'un coup d'œil, la personne qui la vend, et l'offre à portée de pouce. Sur le portant, la même
// carte pend à son cintre.
export function DressingCard({ item, index = 0, showSeller = true, className }: { item: DressingItem; index?: number; showSeller?: boolean; className?: string }) {
  const t = useTranslations("dressing");
  const market = useTranslations("market");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const tone = dressingTone(item.sellerId);
  const fine = item.condition === "new_with_tags" || item.condition === "new_without_tags" || item.condition === "like_new";
  const name = dressingFirstName(item.sellerName);

  return (
    <article className={cn("vd-card", className)} style={{ "--i": index % 8, "--tone": tone.surface, "--sway-delay": `${(index % 5) * -0.7}s` } as CSSProperties}>
      <Hanger className="vd-card__hook" />
      <div className="vd-card__media">
        <Link href={`/annonce/${item.id}`} className="vd-card__link" aria-label={`${item.brand ? `${item.brand} · ` : ""}${item.title} · ${formatPrice(item.priceMillimes, locale)}`}>
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt="" fill sizes="(min-width: 1024px) 22vw, (min-width: 640px) 33vw, 50vw" className="vd-card__photo" />
          ) : (
            <PhotoPlaceholder label={market("noPhoto")} />
          )}
        </Link>
        <span className={cn("vd-card__state", fine && "vd-card__state--fine")}>{conditions(item.condition)}</span>
        {item.reserved ? <span className="vd-card__reserved">{market("reserved")}</span> : null}
        <DressingHeart listingId={item.id} title={item.title} />
      </div>
      <div className="vd-card__body">
        <p className="vd-card__row">
          <span className="vd-card__brand" dir="auto">{item.brand ?? t("noBrand")}</span>
          {item.size ? <span className="vd-card__size" dir="ltr">{t("sizeShort", { size: item.size })}</span> : null}
        </p>
        <h3 className="vd-card__title" dir="auto">{item.title}</h3>
        <p className="vd-card__price">{formatPrice(item.priceMillimes, locale)}</p>
        {showSeller ? (
          <Link href={`/vide-dressing/dressing/${item.sellerId}`} className="vd-card__seller" aria-label={t("dressingOf", { name })}>
            <span className="vd-avatar vd-avatar--xs" style={{ background: tone.surface, color: tone.ink }} aria-hidden="true">
              {dressingMonogram(item.sellerName)}
            </span>
            <span className="truncate" dir="auto">
              {[name, item.place ? localizedName(item.place, locale) : null].filter(Boolean).join(" · ")}
            </span>
          </Link>
        ) : null}
        {item.reserved ? null : (
          <Link href={`/annonce/${item.id}#contact`} className="vd-card__offer">
            {t("makeOffer")}
          </Link>
        )}
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
