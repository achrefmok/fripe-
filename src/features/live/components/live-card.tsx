import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/utils/format";
import type { Live } from "../queries";
import { LiveBadge } from "./live-parts";

// Un Live dans la liste : sa couverture en format vertical, son état, la boutique et le nombre de pièces.
export function LiveCard({ live, href }: { live: Live; href?: string }) {
  const t = useTranslations("live");
  const locale = useLocale();

  const state =
    live.status === "live"
      ? null
      : live.status === "scheduled"
        ? live.scheduledAt
          ? t("scheduledFor", { date: formatDateTime(live.scheduledAt, locale) })
          : t("noDate")
        : live.status === "ended"
          ? t("ended")
          : t("cancelled");

  return (
    <Link href={href ?? `/lives/${live.id}`} className="live-card" data-status={live.status}>
      <span className="live-card__media">
        {live.coverUrl ? <Image src={live.coverUrl} alt="" fill unoptimized sizes="(min-width: 768px) 18rem, 60vw" className="live-card__photo" /> : null}
        <span className="live-card__veil" aria-hidden="true" />
        <span className="live-card__state">{live.status === "live" ? <LiveBadge label={t("liveNow")} /> : <span className="live-count">{state}</span>}</span>
        <span className="live-card__foot">
          <span className="line-clamp-2 font-display text-xl leading-tight" dir="auto">{live.title}</span>
          <span className="flex min-w-0 items-center gap-2 text-xs">
            <ShopMark name={live.shop.name} logoPath={live.shop.logoPath} size="xs" />
            <span className="truncate" dir="auto">{live.shop.name}</span>
            <span className="shrink-0 opacity-80">· {t("pieces", { count: live.products.length })}</span>
          </span>
        </span>
      </span>
    </Link>
  );
}
