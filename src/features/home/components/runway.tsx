"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ProductCardData } from "@/features/catalog/queries";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

export type Look = {
  id: string;
  title: string;
  shopName: string;
  shopLogoPath: string | null;
  href: string;
  products: ProductCardData[];
};

const STEP_MS = 6500;
const LEAVE_MS = 700;
const REDUCED = "(prefers-reduced-motion: reduce)";
// Trois places sur le podium : la pièce principale devant, les deux autres en retrait.
const SPOTS = ["center", "left", "right"] as const;

function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function Figures({ look, locale, leaving }: { look: Look; locale: string; leaving?: boolean }) {
  return look.products.slice(0, 3).map((product, index) => (
    <div
      key={`${look.id}-${product.id}`}
      className={`runway__figure runway__figure--${SPOTS[index]}${leaving ? " is-leaving" : ""}`}
      style={{ "--i": index } as CSSProperties}
    >
      <div className="runway__pose">
        <span className="runway__photo">
          {product.imagePath ? (
            <Image src={productImageUrl(product.imagePath)} alt="" fill unoptimized sizes="(min-width: 768px) 16rem, 44vw" className="object-cover" />
          ) : null}
          {index === 0 ? <span className="price-tag absolute bottom-3 start-0">{formatPrice(product.priceMillimes, locale)}</span> : null}
        </span>
      </div>
    </div>
  ));
}

// Les looks défilent seuls, mais le visiteur garde la main : pause, flèches, pastilles, glisser.
// Le défilement s'arrête au survol, au focus et quand l'utilisateur limite les animations.
export function Runway({ looks, title, cta }: { looks: Look[]; title: string; cta: string }) {
  const t = useTranslations("home");
  const locale = useLocale();
  const reduced = useSyncExternalStore(subscribeToMotion, () => window.matchMedia(REDUCED).matches, () => false);
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const startX = useRef<number | null>(null);
  const count = looks.length;
  const playing = count > 1 && !paused && !reduced;
  const running = playing && !holding;

  function show(next: number) {
    const target = (next + count) % count;
    if (target === index) return;
    if (!reduced) setLeaving(index);
    setIndex(target);
  }

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  const look = looks[index];
  const total = look.products.reduce((sum, product) => sum + product.priceMillimes, 0);
  const rtl = locale === "ar";

  function swipe(event: PointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const distance = event.clientX - startX.current;
    startX.current = null;
    if (Math.abs(distance) < 48) return;
    show(index + ((distance < 0) !== rtl ? 1 : -1));
  }

  return (
    <section
      id="defile"
      className="runway"
      aria-roledescription="carousel"
      aria-labelledby="defile-titre"
      onMouseEnter={() => setHolding(true)}
      onMouseLeave={() => setHolding(false)}
      onFocus={() => setHolding(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false);
      }}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pt-12 md:px-6 md:pt-16">
        <h2 id="defile-titre" className="max-w-3xl font-display text-4xl leading-[0.95] font-extrabold md:text-7xl">
          {title}
        </h2>
        <div className="flex items-center gap-3">
          <Link href="/walk" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">
            {t("defileWalk")}
            <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          </Link>
          {count > 1 && !reduced ? (
            <button type="button" className="runway__control" onClick={() => setPaused(!paused)} aria-label={paused ? t("runwayPlay") : t("runwayPause")}>
              {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="runway__stage"
        aria-hidden="true"
        onPointerDown={(event) => {
          startX.current = event.clientX;
        }}
        onPointerUp={swipe}
        onPointerCancel={() => {
          startX.current = null;
        }}
      >
        <div key={`lumiere-${look.id}`} className="runway__light" />
        <div className="runway__floor" />
        <div className="runway__scene">
          {leaving !== null ? <Figures look={looks[leaving]} locale={locale} leaving /> : null}
          <Figures key={look.id} look={look} locale={locale} />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-12 md:px-6 md:pb-16">
        <div className="runway__card" aria-live={running ? "off" : "polite"} aria-atomic="true">
          {playing ? (
            // Le temps avant le look suivant ; il se fige en même temps que le défilé.
            <span
              key={`temps-${index}`}
              className="runway__timer"
              style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: holding ? "paused" : "running" } as CSSProperties}
              onAnimationEnd={() => show(index + 1)}
              aria-hidden="true"
            />
          ) : null}

          <div className="min-w-0">
            <p className="text-sm font-semibold tabular-nums opacity-75">{t("runwayPosition", { index: index + 1, count })}</p>
            <p className="mt-1 truncate font-display text-2xl font-extrabold md:text-3xl">{look.title}</p>
            <p className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold">
              <ShopMark name={look.shopName} logoPath={look.shopLogoPath} size="xs" />
              <span className="truncate">{look.shopName}</span>
            </p>
          </div>

          <ul className="runway__items">
            {look.products.slice(0, 3).map((product) => (
              <li key={product.id}>
                <Link href={`/produit/${product.id}`} className="flex min-h-11 items-center justify-between gap-4 hover:underline">
                  <span className="truncate">{product.title}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatPrice(product.priceMillimes, locale)}</span>
                </Link>
              </li>
            ))}
            {look.products.length > 3 ? <li className="py-2 text-sm opacity-75">{t("runwayMore", { count: look.products.length - 3 })}</li> : null}
          </ul>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {count > 1 ? (
              <>
                <button type="button" className="runway__control" onClick={() => show(index - 1)} aria-label={t("runwayPrevious")}>
                  <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                </button>
                <button type="button" className="runway__control" onClick={() => show(index + 1)} aria-label={t("runwayNext")}>
                  <ChevronRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                </button>
              </>
            ) : null}
            <Link href={look.href} className="runway__cta">
              {cta}
              <span className="tabular-nums">· {formatPrice(total, locale)}</span>
            </Link>
          </div>
        </div>

        {count > 1 ? (
          <div className="mt-6 flex justify-center gap-1">
            {looks.map((entry, dot) => (
              <button
                key={entry.id}
                type="button"
                className="runway__dot"
                aria-label={t("runwayGoTo", { index: dot + 1 })}
                aria-current={dot === index ? "true" : undefined}
                onClick={() => show(dot)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
