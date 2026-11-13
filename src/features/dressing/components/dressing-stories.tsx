"use client";

import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";
import type { DressingPreview } from "../queries";
import { dressingFirstName, dressingMonogram, dressingTone } from "../tone";

const KEY = "vd:last-visit";
// À la première visite, est nouveau ce qui est arrivé ces trois derniers jours.
const FIRST_VISIT_WINDOW = 3 * 24 * 60 * 60 * 1000;

let previousVisit: number | undefined;

function subscribe() {
  return () => {};
}

// La visite précédente, lue une seule fois par chargement : la noter ensuite ne change pas les
// cercles qu'on est en train de regarder.
function readPreviousVisit() {
  if (previousVisit === undefined) {
    try {
      const saved = Number(localStorage.getItem(KEY));
      previousVisit = Number.isFinite(saved) && saved > 0 ? saved : Date.now() - FIRST_VISIT_WINDOW;
    } catch {
      previousVisit = Date.now() - FIRST_VISIT_WINDOW;
    }
  }
  return previousVisit;
}

// Les dressings du jour, en cercles comme des stories : l'anneau d'or tourne autour de ceux qui
// ont de nouvelles pièces depuis la dernière visite.
export function DressingStories({ dressings, sellHref }: { dressings: DressingPreview[]; sellHref: string }) {
  const t = useTranslations("dressing");
  const locale = useLocale();
  const since = useSyncExternalStore(subscribe, readPreviousVisit, () => undefined);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      // Navigation privée stricte : les cercles resteront calculés sur trois jours.
    }
  }, []);

  const isNew = (dressing: DressingPreview) => {
    if (since === undefined || !dressing.latestAt) return false;
    return Date.parse(dressing.latestAt) > since;
  };

  return (
    <ul className="vd-stories rail-scroll">
      {dressings.map((dressing, index) => {
        const tone = dressingTone(dressing.sellerId);
        const fresh = isNew(dressing);
        return (
          <li key={dressing.sellerId} style={{ "--i": index } as CSSProperties}>
            <Link href={`/vide-dressing/dressing/${dressing.sellerId}`} className="vd-story" data-new={fresh ? "" : undefined}>
              <span className="vd-story__ring" aria-hidden="true">
                <span className="vd-story__disc" style={{ "--tone": tone.surface } as CSSProperties}>
                  {dressingMonogram(dressing.sellerName)}
                </span>
              </span>
              <span className="vd-story__name" dir="auto">
                {dressingFirstName(dressing.sellerName)}
              </span>
              <span className="vd-story__meta" dir="auto">
                {fresh ? t("dayNew") : dressing.place ? localizedName(dressing.place, locale) : t("piecesCount", { count: dressing.count })}
              </span>
            </Link>
          </li>
        );
      })}
      <li style={{ "--i": dressings.length } as CSSProperties}>
        <Link href={sellHref} className="vd-story vd-story--yours">
          <span className="vd-story__ring" aria-hidden="true">
            <span className="vd-story__disc">
              <Plus className="size-5" />
            </span>
          </span>
          <span className="vd-story__name">{t("yours")}</span>
          <span className="vd-story__meta">{t("yoursOpen")}</span>
        </Link>
      </li>
    </ul>
  );
}
