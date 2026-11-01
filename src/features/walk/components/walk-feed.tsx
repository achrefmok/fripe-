"use client";

import { Heart, Pause, Play, Share2, ShoppingBag, Store, Volume2, VolumeX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { loadWalkPage, toggleVideoFavorite } from "@/features/walk/actions";
import type { WalkItem } from "@/features/walk/queries";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import { publicVideoUrl } from "@/lib/utils/storage";

// Seule la vidéo visible et ses deux voisines reçoivent une source : le reste n'est jamais chargé.
const LOADED_RADIUS = 1;

function canAutoplay() {
  if (typeof window === "undefined") return false;

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !connection?.saveData;
}

function WalkSlide({
  item,
  active,
  loaded,
  signedIn,
  isFavorite,
  muted,
  onToggleMute,
  onVisible,
}: {
  item: WalkItem;
  active: boolean;
  loaded: boolean;
  signedIn: boolean;
  isFavorite: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onVisible: () => void;
}) {
  const t = useTranslations("walk");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const slide = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [favorite, setFavorite] = useState(isFavorite);
  const [count, setCount] = useState(item.favoriteCount);
  const [paused, setPaused] = useState(true);
  const [showProducts, setShowProducts] = useState(false);

  useEffect(() => {
    const element = slide.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible();
      },
      { threshold: 0.7 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [onVisible]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;

    if (active && canAutoplay()) {
      element.play().catch(() => setPaused(true));
    } else {
      element.pause();
    }
  }, [active, loaded]);

  function togglePlay() {
    const element = video.current;
    if (!element) return;

    if (element.paused) element.play().catch(() => undefined);
    else element.pause();
  }

  async function favoriteVideo() {
    if (!signedIn) {
      router.push({ pathname: "/connexion", query: { next: `/walk?v=${item.id}` } });
      return;
    }

    const result = await toggleVideoFavorite(item.id);

    if (result.ok) {
      setFavorite(result.data.favorite);
      setCount(count + (result.data.favorite ? 1 : -1));
    } else {
      toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
    }
  }

  function share() {
    const url = `${window.location.origin}${window.location.pathname}?v=${item.id}`;

    if (navigator.share) {
      navigator.share({ title: item.shop.name, url }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success(t("linkCopied")));
    }
  }

  return (
    <section
      ref={slide}
      aria-label={item.shop.name}
      data-active={active}
      className="relative h-full snap-start snap-always overflow-hidden bg-[oklch(0.15_0.01_55)] text-[oklch(0.955_0.016_88)]"
    >
      <video
        ref={video}
        src={loaded ? publicVideoUrl(item.videoPath) : undefined}
        poster={publicVideoUrl(item.thumbnailPath)}
        preload={active ? "auto" : "metadata"}
        loop
        muted={muted}
        playsInline
        aria-label={item.description ?? item.shop.name}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onClick={togglePlay}
        className="absolute inset-0 size-full object-contain"
      />

      {paused ? (
        <button
          type="button"
          aria-label={t("play")}
          onClick={togglePlay}
          className="absolute inset-0 m-auto flex size-16 items-center justify-center bg-black/50"
        >
          <Play className="size-8" />
        </button>
      ) : null}

      <div className="absolute end-3 bottom-24 flex flex-col items-center gap-3">
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? t("unfavorite") : t("favorite")}
          onClick={favoriteVideo}
          className="flex size-11 flex-col items-center justify-center bg-black/50 text-xs"
        >
          <Heart className={favorite ? "size-5 fill-harissa text-harissa" : "size-5"} />
          {count}
        </button>
        <button type="button" aria-label={t("share")} onClick={share} className="flex size-11 items-center justify-center bg-black/50">
          <Share2 className="size-5" />
        </button>
        <button
          type="button"
          aria-label={muted ? t("unmute") : t("mute")}
          onClick={onToggleMute}
          className="flex size-11 items-center justify-center bg-black/50"
        >
          {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
        {paused ? null : (
          <button type="button" aria-label={t("pause")} onClick={togglePlay} className="flex size-11 items-center justify-center bg-black/50">
            <Pause className="size-5" />
          </button>
        )}
        {signedIn ? <ReportDialog targetType="video" targetId={item.id} variant="overlay" /> : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-12">
        <Link href={`/boutique/${item.shop.slug}`} className="inline-flex items-center gap-2 font-display text-lg font-bold">
          <Store className="size-4" />
          {item.shop.name}
        </Link>
        {item.description ? <p className="mt-1 line-clamp-2 max-w-[80%] text-sm">{item.description}</p> : null}

        {item.products.length ? (
          <div className="mt-2">
            <button
              type="button"
              aria-expanded={showProducts}
              onClick={() => setShowProducts(!showProducts)}
              className="inline-flex items-center gap-2 bg-paper px-3 py-1.5 text-sm font-semibold text-[oklch(0.2_0.014_55)]"
            >
              <ShoppingBag className="size-4" />
              {t("pieces", { count: item.products.length })}
            </button>
            {showProducts ? (
              <ul className="mt-2 grid max-w-[80%] gap-1">
                {item.products.map((product) => (
                  <li key={product.id}>
                    <Link href={`/produit/${product.id}`} className="flex justify-between gap-3 bg-black/60 px-3 py-2 text-sm">
                      <span className="truncate">{product.title}</span>
                      <span className="shrink-0 font-semibold">{formatPrice(product.priceMillimes, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function WalkFeed({
  initialItems,
  initialCursor,
  signedIn,
  favoriteIds,
}: {
  initialItems: WalkItem[];
  initialCursor: string | null;
  signedIn: boolean;
  favoriteIds: string[];
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const loading = useRef(false);

  const loadMore = useCallback(async () => {
    if (!cursor || loading.current) return;

    loading.current = true;
    const result = await loadWalkPage(cursor);
    loading.current = false;

    if (result.ok) {
      setItems((current) => [
        ...current,
        ...result.data.items.filter((item) => !current.some((known) => known.id === item.id)),
      ]);
      setCursor(result.data.nextCursor);
    }
  }, [cursor]);

  function activate(index: number) {
    setActiveIndex(index);
    if (index >= items.length - 2) void loadMore();
  }

  return (
    <div className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain" data-testid="walk-feed">
      {items.map((item, index) => (
        <WalkSlide
          key={item.id}
          item={item}
          active={index === activeIndex}
          loaded={Math.abs(index - activeIndex) <= LOADED_RADIUS}
          signedIn={signedIn}
          isFavorite={favoriteIds.includes(item.id)}
          muted={muted}
          onToggleMute={() => setMuted(!muted)}
          onVisible={() => activate(index)}
        />
      ))}
    </div>
  );
}
