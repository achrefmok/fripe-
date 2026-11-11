"use client";

import { Eye, ShoppingBag, Volume2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { Link } from "@/i18n/navigation";
import { formatDateTime, localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import type { Live, LiveComment, LiveProduct } from "../queries";
import { useLiveSync } from "../use-live-sync";
import { useLiveViewerVideo } from "../use-live-video";
import { LiveBadge, LiveComments, LiveProductRow, LiveProductSheet } from "./live-parts";

// Le Live côté client : la vidéo de la boutique, la pièce présentée posée dessus, le fil des
// commentaires et les pièces à portée de main. On regarde, on demande, on achète, sans quitter le direct.
export function LiveRoom({ initialLive, initialComments, signedIn }: { initialLive: Live; initialComments: LiveComment[]; signedIn: boolean }) {
  const t = useTranslations("live");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const { live, comments, refresh } = useLiveSync(initialLive, initialComments);
  const onAir = live.status === "live";
  const { video, audio, state, viewers, needsAudio, startAudio, retry } = useLiveViewerVideo(live.id, onAir);
  const [opened, setOpened] = useState<LiveProduct | null>(null);
  const next = `/lives/${live.id}`;
  const pinned = live.products.find((product) => product.id === live.pinnedProductId) ?? null;

  const notice =
    live.status === "scheduled"
      ? `${t("startsSoon")} ${live.scheduledAt ? t("startsAt", { date: formatDateTime(live.scheduledAt, locale) }) : ""}`
      : live.status === "ended"
        ? t("endedNotice")
        : live.status === "cancelled"
          ? t("cancelledNotice")
          : state === "connecting"
            ? t("videoConnecting")
            : state === "waiting"
              ? t("videoWaiting")
              : state === "full"
                ? t("videoFull")
                : state === "error"
                  ? t("videoError")
                  : null;

  return (
    <div className="live-room">
      <div className="live-room__stage">
        <div className="live-room__screen">
          {live.coverUrl && state !== "playing" ? <Image src={live.coverUrl} alt="" fill unoptimized priority sizes="28rem" className="live-room__cover" /> : null}
          <video ref={video} className="live-room__video" playsInline autoPlay muted={false} data-playing={state === "playing" ? "" : undefined} aria-label={live.title} />
          <div ref={audio} hidden />
          <span className="live-room__veil" aria-hidden="true" />

          <div className="live-room__top">
            <Link href={`/boutique/${live.shop.slug}`} className="flex min-w-0 items-center gap-2.5">
              <ShopMark name={live.shop.name} logoPath={live.shop.logoPath} size="md" className="shadow-[0_0_0_2px_oklch(0.78_0.1_82)]" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-lg leading-tight" dir="auto">{live.shop.name}</span>
                {live.shop.city ? <span className="truncate text-xs opacity-80">{localizedName(live.shop.city, locale)}</span> : null}
              </span>
            </Link>
            <span className="flex shrink-0 items-center gap-2">
              {onAir ? <LiveBadge label={t("liveNow")} /> : null}
              {onAir && state === "playing" ? (
                <span className="live-count" role="img" aria-label={t("viewers", { count: viewers })}>
                  <Eye className="size-3.5" aria-hidden="true" />
                  {viewers}
                </span>
              ) : null}
            </span>
          </div>

          {notice ? (
            <div className="live-room__notice" role="status">
              <p>{notice}</p>
              {state === "error" && onAir ? <button type="button" className="live-pill" onClick={retry}>{t("retry")}</button> : null}
            </div>
          ) : null}

          {needsAudio && state === "playing" ? (
            <button type="button" className="live-room__sound" onClick={startAudio}>
              <Volume2 className="size-4" aria-hidden="true" />
              {t("unmute")}
            </button>
          ) : null}

          <AnimatePresence>
            {pinned && onAir ? (
              <motion.button
                key={pinned.id}
                type="button"
                className="live-pin"
                aria-label={`${t("pinnedLabel")} : ${pinned.title}`}
                onClick={() => setOpened(pinned)}
                initial={reduced ? false : { opacity: 0, y: 28, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
              >
                <span className="live-pin__photo">
                  {pinned.imageUrl ? <Image src={pinned.imageUrl} alt="" fill unoptimized sizes="4rem" className="object-cover" /> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col text-start">
                  <span className="live-piece__flag">{t("pinned")}</span>
                  <span className="truncate text-sm font-medium" dir="auto">{pinned.title}</span>
                  <span className="font-display text-xl leading-tight">{formatPrice(pinned.priceMillimes, locale)}</span>
                </span>
                <span className="live-pin__go">
                  <ShoppingBag className="size-4" aria-hidden="true" />
                </span>
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <aside className="live-room__side">
        <div className="flex flex-col gap-1.5">
          <p className="live-kicker">{t("kicker")}</p>
          <h1 className="font-display text-[clamp(26px,3.2vw,38px)] font-normal leading-[1.05]" dir="auto">{live.title}</h1>
          {live.description ? <p className="text-sm leading-relaxed opacity-80" dir="auto">{live.description}</p> : null}
        </div>

        <LiveComments liveId={live.id} comments={comments} open={onAir} signedIn={signedIn} next={next} onPosted={refresh} />

        <section aria-labelledby="live-pieces">
          <h2 id="live-pieces" className="live-kicker">{t("productsTitle")} · {t("pieces", { count: live.products.length })}</h2>
          {live.products.length ? (
            <ul className="live-pieces rail-scroll">
              {live.products.map((product) => (
                <li key={product.id}>
                  <LiveProductRow product={product} pinned={onAir && product.id === live.pinnedProductId} pinnedLabel={t("pinned")} onOpen={() => setOpened(product)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm opacity-70">{t("productsEmpty")}</p>
          )}
        </section>
      </aside>

      <LiveProductSheet product={opened} onClose={() => setOpened(null)} signedIn={signedIn} next={next} />
    </div>
  );
}
