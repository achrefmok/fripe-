"use client";

import { ArrowLeft, Heart, RotateCcw, X } from "lucide-react";
import type { PanInfo } from "motion/react";
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, KeyboardEvent } from "react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import type { DressingItem } from "../queries";
import { dressingFirstName, dressingTone } from "../tone";
import { PhotoPlaceholder } from "./dressing-card";
import { useDressingFavorites } from "./favorites";

// Au-delà de ce déplacement (en px) ou de cette vitesse, la carte part.
const THROW_DISTANCE = 110;
const THROW_SPEED = 600;

// La carte qui s'en va suit la direction choisie, lue au moment du départ (et non au dernier rendu).
const THROW = {
  gone: (direction: number) => ({ x: direction * 520, rotate: direction * 22, opacity: 0, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const } }),
};
const FADE = { gone: { opacity: 0 } };

function CrushCard({ item, onDecide }: { item: DressingItem; onDecide: (like: boolean) => void }) {
  const t = useTranslations("dressing");
  const market = useTranslations("market");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-16, 16]);
  const likeOpacity = useTransform(x, [30, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -30], [1, 0]);

  function release(_: unknown, info: PanInfo) {
    const like = info.offset.x > THROW_DISTANCE || info.velocity.x > THROW_SPEED;
    const pass = info.offset.x < -THROW_DISTANCE || info.velocity.x < -THROW_SPEED;
    if (like || pass) onDecide(like);
    else animate(x, 0, { type: "spring", stiffness: 500, damping: 30 });
  }

  return (
    <motion.article
      className="vd-crush__card"
      style={{ x, rotate, "--tone": dressingTone(item.sellerId).surface } as unknown as CSSProperties}
      drag={reduced ? false : "x"}
      dragSnapToOrigin={false}
      dragElastic={0.9}
      onDragEnd={release}
      initial={reduced ? false : { scale: 0.92, y: 24, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={reduced ? { opacity: 0 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
    >
      <div className="vd-crush__media">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill unoptimized priority sizes="(min-width: 640px) 26rem, 92vw" className="pointer-events-none object-cover" draggable={false} />
        ) : (
          <PhotoPlaceholder label={market("noPhoto")} />
        )}
        <span className="vd-crush__state">{conditions(item.condition)}</span>
        {item.size ? (
          <span className="vd-crush__size" dir="ltr">
            {t("sizeShort", { size: item.size })}
          </span>
        ) : null}
        <motion.span className="vd-crush__stamp vd-crush__stamp--like" style={{ opacity: likeOpacity }} aria-hidden="true">
          {t("crushStampLike")}
        </motion.span>
        <motion.span className="vd-crush__stamp vd-crush__stamp--pass" style={{ opacity: passOpacity }} aria-hidden="true">
          {t("crushStampPass")}
        </motion.span>
      </div>
      <div className="vd-crush__body">
        <p className="vd-card__brand" dir="auto">{item.brand ?? t("noBrand")}</p>
        <div className="vd-crush__line">
          <h2 className="vd-crush__title" dir="auto">
            <Link href={`/annonce/${item.id}`} draggable={false}>{item.title}</Link>
          </h2>
          <p className="vd-crush__price">{formatPrice(item.priceMillimes, locale)}</p>
        </div>
        <p className="vd-crush__seller" dir="auto">
          {[t("dressingOf", { name: dressingFirstName(item.sellerName) }), item.place ? localizedName(item.place, locale) : null].filter(Boolean).join(" · ")}
        </p>
      </div>
    </motion.article>
  );
}

// Le mode Coup de foudre : les pièces du jour en pile. À droite on garde (favori), à gauche on passe.
// Les boutons et les flèches du clavier font le même geste ; sans mouvement, la carte change sans voler.
export function CrushDeck({ items }: { items: DressingItem[] }) {
  const t = useTranslations("dressing");
  const favorites = useDressingFavorites();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [likes, setLikes] = useState(0);
  const [exit, setExit] = useState<1 | -1>(1);
  const current = items[index];
  const done = index >= items.length;

  async function decide(like: boolean) {
    if (!current) return;
    setExit(like ? 1 : -1);
    setIndex((value) => value + 1);
    if (!like || !favorites) return;
    if (favorites.has(current.id)) {
      setLikes((value) => value + 1);
      return;
    }
    const result = await favorites.toggle(current.id);
    if (result) setLikes((value) => value + 1);
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (done) return;
    const rtl = document.documentElement.dir === "rtl";
    if (event.key === "ArrowRight") {
      event.preventDefault();
      void decide(!rtl);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      void decide(rtl);
    }
  }

  return (
    <div className="vd-crush" onKeyDown={onKey}>
      <header className="vd-crush__head">
        <Link href="/vide-dressing" className="vd-crush__back" aria-label={t("backToAll")}>
          <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
        <div className="text-center">
          <h1 className="vd-crush__heading">{t.rich("crushTitle", { em: (chunks) => <em>{chunks}</em> })}</h1>
          <p className="vd-crush__progress" aria-live="polite">
            {done ? t("crushLikes", { count: likes }) : t("crushProgress", { current: index + 1, total: items.length })}
          </p>
        </div>
        <span className="vd-crush__count" aria-label={t("crushLikes", { count: likes })}>
          <Heart className="size-4 fill-current" aria-hidden="true" />
          <motion.span key={likes} initial={reduced ? false : { scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
            {likes}
          </motion.span>
        </span>
      </header>

      <div className="vd-crush__stage">
        {done ? (
          <motion.div className="vd-crush__done" initial={reduced ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            <Heart className="vd-crush__done-heart" aria-hidden="true" />
            <h2 className="vd-crush__done-title">{t.rich("crushDoneTitle", { em: (chunks) => <em>{chunks}</em> })}</h2>
            <p className="text-muted-foreground">{t("crushDoneBody", { count: likes })}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2.5">
              {likes ? (
                <Link href="/compte/favoris" className="vd-hero__cta">
                  {t("crushFavorites")}
                </Link>
              ) : null}
              <button
                type="button"
                className="vd-crush__again"
                onClick={() => {
                  setIndex(0);
                  setLikes(0);
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {t("crushAgain")}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="vd-crush__pile">
            {items.slice(index + 1, index + 3).map((item, depth) => (
              <span key={item.id} className="vd-crush__under" style={{ "--depth": depth + 1 } as CSSProperties} aria-hidden="true" />
            ))}
            <AnimatePresence custom={exit} initial={false}>
              <motion.div
                key={current.id}
                className="vd-crush__slot"
                custom={exit}
                variants={reduced ? FADE : THROW}
                exit="gone"
              >
                <CrushCard item={current} onDecide={(like) => void decide(like)} />
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {done ? null : (
        <>
          <div className="vd-crush__actions">
            <button type="button" className="vd-crush__btn vd-crush__btn--pass" onClick={() => void decide(false)} aria-label={t("pass")}>
              <X className="size-7" aria-hidden="true" />
            </button>
            <Link href={`/annonce/${current.id}#contact`} className="vd-crush__btn vd-crush__btn--offer">
              {t("offer")}
            </Link>
            <button type="button" className="vd-crush__btn vd-crush__btn--like" onClick={() => void decide(true)} aria-label={t("like")}>
              <Heart className="size-8 fill-current" aria-hidden="true" />
            </button>
          </div>
          <p className="vd-crush__hint">{t("crushHint")}</p>
        </>
      )}
    </div>
  );
}
