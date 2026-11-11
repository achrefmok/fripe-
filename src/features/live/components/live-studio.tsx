"use client";

import { Camera, Eye, ExternalLink, MessageCircle, Mic, MicOff, Pin, PinOff, Radio, Square, SwitchCamera } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import { endLive, pinLiveProduct, startLive } from "../actions";
import type { Live, LiveComment, LiveProduct } from "../queries";
import { useLiveSync } from "../use-live-sync";
import { LIVE_MAX_VIEWERS, useLiveHostVideo } from "../use-live-video";
import { LiveForm } from "./live-form";
import { LiveBadge, LiveComments, LiveProductRow } from "./live-parts";

function useElapsed(since: string | null, running: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (!since) return "00:00";
  const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(seconds / 3600);
  return `${hours ? `${hours}:` : ""}${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

// Le studio Live de la boutique : la caméra et ses commandes à gauche, puis les chiffres ; à droite
// les pièces à mettre en avant d'un geste et le fil à modérer. Avant le direct, on prépare ; pendant,
// on présente ; après, on lit le bilan.
export function LiveStudio({
  initialLive,
  initialComments,
  candidates,
  sales,
}: {
  initialLive: Live;
  initialComments: LiveComment[];
  candidates: LiveProduct[];
  sales: { pieces: number; revenueMillimes: number };
}) {
  const t = useTranslations("live");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const { live, comments, refresh } = useLiveSync(initialLive, initialComments);
  const onAir = live.status === "live";
  const over = live.status === "ended" || live.status === "cancelled";
  const { video, state, viewers, micOn, startPreview, flip, toggleMic } = useLiveHostVideo(live.id, onAir);
  const elapsed = useElapsed(live.startedAt, onAir);
  const [pending, startTransition] = useTransition();
  const base = `/vendeur/boutique/${live.shopId}`;
  const hasCamera = state === "preview" || state === "connecting" || state === "live";

  // Les ventes viennent du serveur : on les relit de temps en temps pendant le direct.
  useEffect(() => {
    if (!onAir) return;
    const timer = window.setInterval(() => router.refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [onAir, router]);

  function fail(error: string) {
    toast.error(errors.has(error) ? errors(error) : errors("unexpected"));
  }

  function goLive() {
    startTransition(async () => {
      // La caméra d'abord : inutile d'annoncer un direct que l'on ne peut pas filmer.
      if (!(await startPreview())) return;
      const result = await startLive(live.shopId, live.id);
      if (result.ok) {
        toast.success(t("liveStarted"));
        await refresh();
      } else fail(result.error);
    });
  }

  function stop() {
    if (!window.confirm(t("endConfirm"))) return;
    startTransition(async () => {
      const result = await endLive(live.shopId, live.id);
      if (result.ok) {
        toast.success(t("liveEnded"));
        await refresh();
        router.refresh();
      } else fail(result.error);
    });
  }

  function pin(productId: string | null) {
    startTransition(async () => {
      const result = await pinLiveProduct(live.id, productId);
      if (result.ok) await refresh();
      else fail(result.error);
    });
  }

  const stats = [
    { label: onAir ? t("statViewers") : t("statPeak"), value: onAir ? viewers : live.viewerPeak, icon: Eye },
    { label: t("statComments"), value: live.commentCount, icon: MessageCircle },
    { label: t("statSold"), value: sales.pieces, icon: null },
    { label: t("statRevenue"), value: formatPrice(sales.revenueMillimes, locale), icon: null },
  ];

  return (
    <div className="studio">
      <header className="studio__head">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="luxe-kicker">{t("studioKicker")}</p>
          <h2 className="font-display text-[clamp(26px,3.4vw,36px)] font-normal leading-tight" dir="auto">{live.title}</h2>
          <p className="text-sm text-muted-foreground">
            {onAir
              ? t("onAir", { duration: elapsed })
              : live.status === "ended"
                ? t("ended")
                : live.status === "cancelled"
                  ? t("cancelled")
                  : live.scheduledAt
                    ? t("scheduledFor", { date: formatDateTime(live.scheduledAt, locale) })
                    : t("studioReady")}
          </p>
        </div>
        {live.status !== "cancelled" ? (
          <Link href={`/lives/${live.id}`} target="_blank" className="studio__ghost">
            {t("publicLink")}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      <div className="studio__grid">
        <div className="studio__left">
          {over ? null : (
            <div className="studio__monitor">
              <video ref={video} className="studio__video" playsInline autoPlay muted aria-label={t("studioCamera")} data-on={hasCamera ? "" : undefined} />
              {live.coverUrl && !hasCamera ? <Image src={live.coverUrl} alt="" fill unoptimized sizes="24rem" className="studio__cover" /> : null}
              <span className="live-room__veil" aria-hidden="true" />

              <div className="live-room__top">
                {onAir ? <LiveBadge label={`${t("liveNow")} · ${elapsed}`} /> : <span className="live-count">{t("scheduled")}</span>}
                {onAir ? (
                  <span className="live-count" role="img" aria-label={t("viewers", { count: viewers })}>
                    <Eye className="size-3.5" aria-hidden="true" />
                    {viewers}
                  </span>
                ) : null}
              </div>

              {state === "denied" || state === "error" ? (
                <div className="live-room__notice" role="alert">
                  <p>{state === "denied" ? t("cameraDenied") : t("videoError")}</p>
                </div>
              ) : null}

              <div className="studio__controls">
                {hasCamera ? (
                  <>
                    <button type="button" className="walk-round" aria-label={t("cameraFlip")} onClick={() => void flip()}>
                      <SwitchCamera className="size-5" aria-hidden="true" />
                    </button>
                    <button type="button" className="walk-round" aria-pressed={!micOn} aria-label={micOn ? t("micOn") : t("micOff")} onClick={toggleMic}>
                      {micOn ? <Mic className="size-5" aria-hidden="true" /> : <MicOff className="size-5" aria-hidden="true" />}
                    </button>
                  </>
                ) : (
                  <button type="button" className="live-pill" onClick={() => void startPreview()}>
                    <Camera className="size-4" aria-hidden="true" />
                    {t("cameraStart")}
                  </button>
                )}
              </div>
            </div>
          )}

          {over ? null : onAir ? (
            <button type="button" className="studio__cta studio__cta--stop" onClick={stop} disabled={pending}>
              <Square className="size-4 fill-current" aria-hidden="true" />
              {t("endLive")}
            </button>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button type="button" className="studio__cta" onClick={goLive} disabled={pending}>
                <Radio className="size-[18px]" aria-hidden="true" />
                {t("goLive")}
              </button>
              <p className="text-center text-xs text-muted-foreground">{t("goLiveHint", { max: LIVE_MAX_VIEWERS })}</p>
            </div>
          )}

          <section aria-labelledby="studio-stats">
            <h3 id="studio-stats" className="luxe-kicker">{t("statsTitle")}</h3>
            <dl className="studio__stats">
              {stats.map((stat) => (
                <div key={stat.label} className="studio__stat">
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
            {sales.pieces ? (
              <Link href={`${base}/commandes`} className="mt-2 inline-flex min-h-9 items-center text-sm font-medium text-goldink underline underline-offset-4">
                {t("ordersLink")}
              </Link>
            ) : null}
          </section>
        </div>

        <div className="studio__right">
          <section className="studio__panel" aria-labelledby="studio-pieces">
            <h3 id="studio-pieces" className="luxe-kicker">{t("productsTitle")} · {t("pieces", { count: live.products.length })}</h3>
            {live.products.length ? (
              <ul className="mt-2 grid gap-2">
                {live.products.map((product) => {
                  const pinned = product.id === live.pinnedProductId;
                  return (
                    <li key={product.id}>
                      <LiveProductRow product={product} pinned={pinned} pinnedLabel={t("pinnedNow")}>
                        {onAir ? (
                          <button type="button" className="studio__pin" aria-pressed={pinned} onClick={() => pin(pinned ? null : product.id)} disabled={pending}>
                            {pinned ? <PinOff className="size-4" aria-hidden="true" /> : <Pin className="size-4" aria-hidden="true" />}
                            <span>{pinned ? t("unpin") : t("pin")}</span>
                          </button>
                        ) : null}
                      </LiveProductRow>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("productsEmpty")}</p>
            )}
          </section>

          <section className="studio__panel studio__panel--night" aria-label={t("commentsTitle")}>
            <h3 className="live-kicker">{t("commentsTitle")}</h3>
            <LiveComments liveId={live.id} comments={comments} open={onAir} signedIn canModerate next={`${base}/lives/${live.id}`} onPosted={refresh} />
          </section>
        </div>
      </div>

      {over ? null : (
        <details className="studio__edit" open={!onAir && !live.products.length}>
          <summary>{onAir ? t("manageProducts") : t("editTitle")}</summary>
          <div className="pt-4">
            <LiveForm key={live.products.map((product) => product.id).join()} shopId={live.shopId} live={live} candidates={candidates} />
          </div>
        </details>
      )}
    </div>
  );
}
