import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";
import type { DressingPreview } from "../queries";
import { dressingFirstName, dressingMonogram, dressingTone } from "../tone";

// La vitrine d'un dressing : sa teinte, son monogramme, trois pièces qui dépassent de la penderie
// et les marques qu'on y trouve.
export function DressingTile({ dressing, index = 0 }: { dressing: DressingPreview; index?: number }) {
  const t = useTranslations("dressing");
  const locale = useLocale();
  const tone = dressingTone(dressing.sellerId);
  const name = dressingFirstName(dressing.sellerName);

  return (
    <Link
      href={`/vide-dressing/dressing/${dressing.sellerId}`}
      className="vd-tile"
      style={{ "--tone": tone.surface, "--tone-ink": tone.ink, "--i": index } as CSSProperties}
    >
      <span className="vd-tile__closet" aria-hidden="true">
        <span className="vd-tile__rod" />
        {dressing.previews.map((src, position) => (
          <span key={src} className="vd-tile__piece" data-slot={position}>
            <Image src={src} alt="" fill unoptimized sizes="9rem" className="object-cover" />
          </span>
        ))}
      </span>
      <span className="vd-tile__foot">
        <span className="vd-avatar" aria-hidden="true">{dressingMonogram(dressing.sellerName)}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-xl leading-tight" dir="auto">{t("dressingOf", { name })}</span>
          <span className="truncate text-xs opacity-80">
            {[dressing.place ? localizedName(dressing.place, locale) : null, t("piecesCount", { count: dressing.count })].filter(Boolean).join(" · ")}
          </span>
          {dressing.brands.length ? <span className="truncate text-xs opacity-70" dir="auto">{dressing.brands.join(" · ")}</span> : null}
        </span>
        <ArrowRight className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
      </span>
    </Link>
  );
}
