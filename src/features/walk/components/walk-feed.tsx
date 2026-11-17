"use client";

import { ArrowDown, ArrowUp, Heart, Pause, Play, Share2, ShoppingBag, Store, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShopMark } from "@/features/shops/components/shop-mark";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { addToCart } from "@/features/orders/actions";
import { loadWalkPage, toggleVideoFavorite } from "@/features/walk/actions";
import type { WalkItem } from "@/features/walk/queries";
import { Link, useRouter } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl, publicVideoUrl } from "@/lib/utils/storage";

// Seule la vidéo visible et ses deux voisines reçoivent une source : le reste n'est jamais chargé.
const LOADED_RADIUS = 1;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canAutoplay() {
  if (typeof window === "undefined") return false;

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !reducedMotion() && !connection?.saveData;
}

function HangerHook() {
  return (
    <svg viewBox="0 0 100 40" className="walk-piece__hook" aria-hidden="true">
      <path d="M50 3c4 0 6 4 3 7-2 1-3 2-3 5" />
      <path d="M50 15 8 36h84z" />
    </svg>
  );
}

function WalkSlide({
  item,
  active,
  upcoming,
  loaded,
  signedIn,
  isFavorite,
  muted,
  onToggleMute,
  onVisible,
}: {
  item: WalkItem;
  active: boolean;
  // La vidéo suivante se charge déjà en entier : elle démarre sans attente au défilement.
  upcoming: boolean;
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
  const [burst, setBurst] = useState(0);

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
      setCount((value) => value + (result.data.favorite ? 1 : -1));
    } else {
      toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
    }
  }

  // Deux touches sur la vidéo : un cœur d'or s'élève, la vidéo rejoint les favoris (jamais l'inverse).
  function likeFromVideo() {
    if (!signedIn) return;
    setBurst((value) => value + 1);
    if (!favorite) void favoriteVideo();
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
    <section ref={slide} aria-label={item.shop.name} data-active={active} className="walk-slide">
      <div className="walk-slide__frame">
        <video
          ref={video}
          src={loaded ? publicVideoUrl(item.videoPath) : undefined}
          poster={publicVideoUrl(item.thumbnailPath)}
          preload={active || upcoming ? "auto" : "metadata"}
          loop
          muted={muted}
          playsInline
          aria-label={item.description ?? item.shop.name}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onClick={togglePlay}
          onDoubleClick={likeFromVideo}
          className="walk-slide__video"
        />

        {burst ? <Heart key={burst} className="walk-slide__burst" aria-hidden="true" /> : null}

        {paused ? (
          <button type="button" aria-label={t("play")} onClick={togglePlay} className="walk-slide__play">
            <Play className="size-8" />
          </button>
        ) : null}

        <div className="walk-slide__controls">
          <button
            type="button"
            aria-pressed={favorite}
            aria-label={favorite ? t("unfavorite") : t("favorite")}
            onClick={favoriteVideo}
            className="walk-round flex-col text-xs"
          >
            <Heart className={favorite ? "size-5 fill-[oklch(0.78_0.1_82)] text-[oklch(0.78_0.1_82)]" : "size-5"} />
            {count}
          </button>
          <button type="button" aria-label={t("share")} onClick={share} className="walk-round">
            <Share2 className="size-5" />
          </button>
          <button type="button" aria-label={muted ? t("unmute") : t("mute")} onClick={onToggleMute} className="walk-round">
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          {paused ? null : (
            <button type="button" aria-label={t("pause")} onClick={togglePlay} className="walk-round">
              <Pause className="size-5" />
            </button>
          )}
          {signedIn ? <ReportDialog targetType="video" targetId={item.id} variant="overlay" /> : null}
        </div>

        <div className="walk-slide__caption">
          <Link href={`/boutique/${item.shop.slug}`} className="inline-flex items-center gap-2 font-display text-[22px]">
            <Store className="size-4" aria-hidden="true" />
            {item.shop.name}
          </Link>
          {item.description ? <p className="mt-1 line-clamp-2 max-w-[80%] text-sm opacity-85">{item.description}</p> : null}

          {/* Sur grand écran, les pièces vivent dans le panneau d'à côté. */}
          {item.products.length ? (
            <div className="mt-2 md:hidden">
              <button
                type="button"
                aria-expanded={showProducts}
                onClick={() => setShowProducts(!showProducts)}
                className="inline-flex items-center gap-2 rounded-full bg-[oklch(0.78_0.1_82)] px-3.5 py-1.5 text-sm font-semibold text-[oklch(0.17_0.008_60)]"
              >
                <ShoppingBag className="size-4" />
                {t("pieces", { count: item.products.length })}
              </button>
              {showProducts ? (
                <ul className="mt-2 grid max-w-[80%] gap-1">
                  {item.products.map((product) => (
                    <li key={product.id}>
                      <Link href={`/produit/${product.id}`} className="flex justify-between gap-3 rounded-full bg-black/60 px-3.5 py-2 text-sm">
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
      </div>
    </section>
  );
}

// Le panneau du grand écran : la boutique, les pièces suspendues à la tringle, la suite du défilé.
function WalkAside({
  item,
  upNext,
  canPrevious,
  canNext,
  onGo,
  onPrevious,
  onNext,
}: {
  item: WalkItem;
  upNext: { item: WalkItem; index: number }[];
  canPrevious: boolean;
  canNext: boolean;
  onGo: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("walk");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  async function add(productId: string) {
    setPending(productId);
    const result = await addToCart(productId);
    setPending(null);

    if (result.ok) {
      setAdded((list) => [...list, productId]);
      toast.success(t("added"));
    } else if (result.error === "sessionExpired") {
      toast(t("signInToAdd"), {
        action: { label: t("signIn"), onClick: () => router.push({ pathname: "/connexion", query: { next: `/walk?v=${item.id}` } }) },
      });
    } else {
      toast.error(t("addFailed"));
    }
  }

  return (
    <aside className="walk-aside" aria-label={item.shop.name}>
      <div className="flex items-center gap-3">
        <ShopMark name={item.shop.name} logoPath={item.shop.logoPath} size="md" className="shadow-[0_0_0_2px_oklch(0.78_0.1_82)]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-[22px] leading-tight" dir="auto">{item.shop.name}</span>
          {item.shop.city ? <span className="text-xs opacity-75">{localizedName(item.shop.city, locale)}</span> : null}
        </span>
        <Link href={`/boutique/${item.shop.slug}`} className="walk-pill">{t("seeShop")}</Link>
      </div>

      {item.description ? <p className="text-sm leading-relaxed opacity-80" dir="auto">{item.description}</p> : null}

      <div>
        <p className="walk-kicker">{t("inVideo")}</p>
        {item.products.length ? (
          <div className="walk-rack">
            <span className="walk-rack__rod" aria-hidden="true" />
            <ul className="walk-rack__pieces">
              {item.products.slice(0, 4).map((product) => (
                <li key={product.id} className="walk-piece">
                  <HangerHook />
                  <Link href={`/produit/${product.id}`} className="walk-piece__photo" aria-label={product.title}>
                    {product.imagePath ? (
                      <Image src={productImageUrl(product.imagePath)} alt="" fill sizes="10rem" className="object-cover" />
                    ) : null}
                  </Link>
                  <span className="mt-2 line-clamp-1 text-center text-[13px] font-medium" dir="auto">{product.title}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="font-display text-lg text-[oklch(0.78_0.1_82)]">{formatPrice(product.priceMillimes, locale)}</span>
                    <button
                      type="button"
                      className="walk-pill walk-pill--cream"
                      onClick={() => void add(product.id)}
                      disabled={pending === product.id || added.includes(product.id)}
                    >
                      {added.includes(product.id) ? t("added") : t("addToCart")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm opacity-70">{t("noPieces")}</p>
        )}
      </div>

      {upNext.length ? (
        <div>
          <p className="walk-kicker">{t("upNext")}</p>
          <ul className="flex flex-col gap-2">
            {upNext.map(({ item: next, index }) => (
              <li key={next.id}>
                <button type="button" className="walk-next" onClick={() => onGo(index)}>
                  <span className="walk-next__thumb">
                    <Image src={publicVideoUrl(next.thumbnailPath)} alt="" fill sizes="2.75rem" className="object-cover" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col text-start">
                    <span className="truncate text-sm font-medium" dir="auto">{next.shop.name}</span>
                    {next.description ? <span className="truncate text-xs opacity-70" dir="auto">{next.description}</span> : null}
                  </span>
                  <Play className="size-4 shrink-0 opacity-60 rtl:-scale-x-100" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex gap-2.5">
        <button type="button" className="walk-step" aria-label={t("previous")} onClick={onPrevious} disabled={!canPrevious}>
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
        <button type="button" className="walk-step walk-step--gold" aria-label={t("next")} onClick={onNext} disabled={!canNext}>
          <ArrowDown className="size-5" aria-hidden="true" />
        </button>
      </div>
    </aside>
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
  const t = useTranslations("walk");
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const loading = useRef(false);
  const feed = useRef<HTMLDivElement>(null);

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

  function goTo(index: number) {
    const slide = feed.current?.children[index];
    slide?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  }

  const current = items[activeIndex] ?? items[0];
  const upNext = items.slice(activeIndex + 1, activeIndex + 4).map((item, offset) => ({ item, index: activeIndex + 1 + offset }));

  return (
    <div className="walk-stage">
      <div className="walk-stage__head">
        <h1 className="font-display text-[clamp(32px,4.4vw,50px)] font-normal leading-none">
          {t.rich("heading", { em: (chunks) => <em className="text-[oklch(0.78_0.1_82)]">{chunks}</em> })}
        </h1>
        <p className="text-[13px] opacity-75">{t("hint")}</p>
        <div className="walk-progress" role="img" aria-label={t("progress", { current: activeIndex + 1, total: items.length })}>
          {items.map((item, index) => (
            <span key={item.id} data-state={index < activeIndex ? "done" : index === activeIndex ? "active" : undefined} />
          ))}
        </div>
      </div>

      <div className="walk-stage__body">
        <div ref={feed} className="walk-feed" data-testid="walk-feed">
          {items.map((item, index) => (
            <WalkSlide
              key={item.id}
              item={item}
              active={index === activeIndex}
              upcoming={index === activeIndex + 1}
              loaded={Math.abs(index - activeIndex) <= LOADED_RADIUS}
              signedIn={signedIn}
              isFavorite={favoriteIds.includes(item.id)}
              muted={muted}
              onToggleMute={() => setMuted(!muted)}
              onVisible={() => activate(index)}
            />
          ))}
        </div>

        <WalkAside
          key={current.id}
          item={current}
          upNext={upNext}
          canPrevious={activeIndex > 0}
          canNext={activeIndex < items.length - 1}
          onGo={goTo}
          onPrevious={() => goTo(activeIndex - 1)}
          onNext={() => goTo(activeIndex + 1)}
        />
      </div>
    </div>
  );
}
