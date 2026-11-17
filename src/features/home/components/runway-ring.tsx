"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ProductCardData } from "@/features/catalog/queries";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

// Le défilé : les dernières pièces tournent sur un carrousel en 3D, sous un projecteur.
// Le tour automatique a toujours une pause, s'arrête au survol et au focus, et reste coupé
// quand le visiteur limite les animations.
export function RunwayRing({ products }: { products: ProductCardData[] }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const count = products.length;
  const active = ((step % count) + count) % count;

  useEffect(() => {
    if (reduced || paused || hovered || count < 2) return;
    const timer = window.setInterval(() => setStep((value) => value + 1), 3600);
    return () => window.clearInterval(timer);
  }, [reduced, paused, hovered, count]);

  if (!count) return null;

  return (
    <section
      id="defile"
      className="lx-runway"
      aria-labelledby="defile-titre"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={() => setHovered(false)}
    >
      <div className="lx-runway__panel">
        <div className="lx-runway__head">
          <div>
            <p className="lx-runway__kicker">{t("runwayKicker")}</p>
            <h2 id="defile-titre" className="lx-runway__title">
              {t.rich("runwayTitle", { em: (chunks) => <em>{chunks}</em> })}
            </h2>
          </div>
          <span className="flex gap-1.5">
            <button type="button" className="lx-round" aria-label={t("runwayPrev")} onClick={() => setStep((value) => value - 1)}>
              <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </button>
            <button type="button" className="lx-round lx-round--wide" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
              {paused || reduced ? t("runwayPlay") : t("runwayPause")}
            </button>
            <button type="button" className="lx-round lx-round--gold" aria-label={t("runwayNext")} onClick={() => setStep((value) => value + 1)}>
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </span>
        </div>
        <span className="lx-runway__beam" aria-hidden="true" />
        <div className="lx-ring" style={{ "--n": count, "--step": step } as CSSProperties}>
          <ul className="lx-ring__carousel" aria-live="off">
            {products.map((product, index) => (
              <li key={product.id} className="lx-ring__card" style={{ "--i": index } as CSSProperties} data-active={index === active ? "" : undefined}>
                <Link href={`/produit/${product.id}`} tabIndex={index === active ? undefined : -1} aria-hidden={index === active ? undefined : true}>
                  <span className="lx-ring__photo">
                    {product.imagePath ? (
                      <Image src={productImageUrl(product.imagePath)} alt={product.title} fill sizes="11rem" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="lx-ring__caption">
                    <span className="truncate" dir="auto">{product.title}</span>
                    <span className="lx-ring__price">{formatPrice(product.priceMillimes, locale)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <span className="lx-ring__floor" aria-hidden="true" />
        </div>
        <div className="lx-ring__dots" aria-hidden="true">
          {products.map((product, index) => (
            <span key={product.id} data-active={index === active ? "" : undefined} />
          ))}
        </div>
      </div>
    </section>
  );
}
