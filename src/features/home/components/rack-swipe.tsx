"use client";

import { ArrowLeft, ArrowRight, Heart, Info } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { toggleFavorite } from "@/features/catalog/actions";
import type { ProductCardData } from "@/features/catalog/queries";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPrice } from "@/lib/utils/price";
import { productImageUrl } from "@/lib/utils/storage";

// Un cintre occupe 72 % de la largeur d'une pièce : c'est le pas du portant.
const STEP = 0.72;

function HangerHook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 40" className={`lx-hook ${className ?? ""}`} aria-hidden="true">
      <path d="M50 3c4 0 6 4 3 7-2 1-3 2-3 5" />
      <path d="M50 15 8 36h84z" />
    </svg>
  );
}

// Le portant à chiner : les cintres suivent le doigt, glissent à gauche ou à droite, se balancent en
// s'arrêtant. « Décrocher » (ou tirer la pièce vers le haut) la soulève de la tringle et la garde
// dans les favoris. Tout se fait aussi aux boutons et aux flèches du clavier.
export function RackSwipe({ products }: { products: ProductCardData[] }) {
  const t = useTranslations("chine");
  const locale = useLocale();
  const router = useRouter();
  const [index, setIndex] = useState(Math.min(2, Math.max(0, products.length - 1)));
  const [sway, setSway] = useState<{ turn: number; direction: number } | null>(null);
  const [kept, setKept] = useState<ProductCardData[]>([]);
  const [leaving, setLeaving] = useState<string | null>(null);
  const rack = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean; pointer: number } | null>(null);
  const current = products[index];

  function move(step: number) {
    const next = Math.max(0, Math.min(products.length - 1, index + step));
    if (next === index) return;
    setIndex(next);
    setSway((value) => ({ turn: (value?.turn ?? 0) + 1, direction: Math.sign(next - index) }));
  }

  async function keep() {
    if (!current || leaving) return;
    const piece = current;
    setLeaving(piece.id);
    const result = await toggleFavorite(piece.id);

    if (!result.ok) {
      setLeaving(null);
      if (result.error === "sessionExpired") {
        toast(t("signInToKeep"), { action: { label: t("signIn"), onClick: () => router.push({ pathname: "/connexion", query: { next: "/chine" } }) } });
      } else toast.error(t("keepFailed"));
      return;
    }

    if (result.data.favorite) {
      setKept((list) => (list.some((item) => item.id === piece.id) ? list : [...list, piece]));
      toast.success(t("kept"));
    } else {
      setKept((list) => list.filter((item) => item.id !== piece.id));
      toast(t("unkept"));
    }
    setLeaving(null);
    move(1);
  }

  function stepWidth() {
    const hanger = rack.current?.querySelector<HTMLElement>("[data-current]");
    return (hanger?.offsetWidth ?? 240) * STEP;
  }

  function follow(dx: number, dy: number) {
    const element = rack.current;
    if (!element) return;
    element.style.setProperty("--drag", String(dx / stepWidth()));
    element.style.setProperty("--lift", `${Math.min(0, Math.max(-90, dy))}px`);
  }

  function release() {
    const element = rack.current;
    if (!element) return;
    element.removeAttribute("data-dragging");
    element.style.setProperty("--drag", "0");
    element.style.setProperty("--lift", "0px");
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false, pointer: event.pointerId };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (!start.moved) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      start.moved = true;
      rack.current?.setAttribute("data-dragging", "");
      rack.current?.setPointerCapture(event.pointerId);
    }

    const vertical = Math.abs(dy) > Math.abs(dx);
    follow(vertical ? 0 : dx, vertical ? dy : 0);
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    release();
    if (!start.moved) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (dy < -60 && Math.abs(dy) > Math.abs(dx)) {
      void keep();
    } else if (Math.abs(dx) > 30) {
      // Le portant suit le geste, dans les deux sens de lecture : glisser vers la gauche avance.
      move(-Math.sign(dx) * Math.max(1, Math.round(Math.abs(dx) / stepWidth())));
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = document.documentElement.dir === "rtl";
    if (event.key === "ArrowRight") move(rtl ? -1 : 1);
    else if (event.key === "ArrowLeft") move(rtl ? 1 : -1);
    else if (event.key === "ArrowUp") void keep();
    else return;
    event.preventDefault();
  }

  if (!current) {
    return <p className="text-center text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="flex w-full flex-col items-center gap-3.5">
      <div
        ref={rack}
        className="lx-rackswipe"
        role="group"
        aria-roledescription={t("rackRole")}
        aria-label={t("rackLabel", { current: index + 1, total: products.length })}
        tabIndex={0}
        data-sway={sway ? sway.turn % 2 : "in"}
        style={{ "--dir": sway?.direction ?? 1 } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          release();
        }}
        onKeyDown={onKeyDown}
      >
        <span className="lx-rackswipe__rod" aria-hidden="true" />
        <span className="lx-rackswipe__end lx-rackswipe__end--start" aria-hidden="true" />
        <span className="lx-rackswipe__end lx-rackswipe__end--end" aria-hidden="true" />
        <div className="lx-rackswipe__track" dir="ltr">
          {products.map((product, position) => {
            const offset = position - index;
            const distance = Math.abs(offset);
            if (distance > 3) return null;
            return (
              <div
                key={product.id}
                className="lx-rackswipe__hanger"
                aria-hidden={offset !== 0}
                data-current={offset === 0 ? "" : undefined}
                data-leaving={leaving === product.id ? "" : undefined}
                style={{ "--d": offset, "--a": distance, "--o": distance > 2 ? 0 : distance === 2 ? 0.45 : 1, zIndex: 20 - distance } as CSSProperties}
                onClick={() => (offset === 0 ? undefined : move(offset))}
              >
                <div className="lx-rackswipe__body">
                  <HangerHook className="lx-rackswipe__hook" />
                  <span className="lx-rackswipe__photo">
                    <Image src={productImageUrl(product.imagePath!)} alt={offset === 0 ? product.title : ""} fill unoptimized draggable={false} sizes="20rem" className="pointer-events-none object-cover" />
                  </span>
                  <span className="lx-rackswipe__tag">
                    <span className="lx-rackswipe__thread" aria-hidden="true" />
                    <span className="lx-rackswipe__price">{formatPrice(product.priceMillimes, locale)}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <span className="lx-rackswipe__floor" aria-hidden="true" />
      </div>

      <div className="flex min-h-[64px] flex-col items-center gap-0.5 text-center" aria-live="polite">
        <span className="font-display text-[clamp(24px,3.4vw,30px)] leading-tight" dir="auto">{current.title}</span>
        <span className="text-[13px] text-muted-foreground">
          {[current.brand, current.size && t("size", { size: current.size })].filter(Boolean).join(" · ") || t("unique")} · {current.shopName}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">{index + 1} / {products.length}</span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <button type="button" className="lx-rackbtn" aria-label={t("previous")} onClick={() => move(-1)} disabled={index === 0}>
          <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        </button>
        <button type="button" className="lx-rackkeep" onClick={() => void keep()} disabled={Boolean(leaving)}>
          <Heart className="size-[18px] fill-current" aria-hidden="true" />
          {t("keep")}
        </button>
        <Link href={`/produit/${current.id}`} className="lx-rackbtn lx-rackbtn--small" aria-label={t("open", { title: current.title })}>
          <Info className="size-4" aria-hidden="true" />
        </Link>
        <button type="button" className="lx-rackbtn" aria-label={t("next")} onClick={() => move(1)} disabled={index === products.length - 1}>
          <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3.5 w-full max-w-[640px]">
        <p className="luxe-kicker mb-1">{t("keptLabel", { count: kept.length })}</p>
        <span className="block h-[3px] rounded-full bg-[linear-gradient(oklch(0.86_0.09_82),oklch(0.6_0.09_72))]" aria-hidden="true" />
        <ul className="lx-kept rail-scroll">
          {kept.map((product) => (
            <li key={product.id}>
              <Link href={`/produit/${product.id}`} className="lx-kept__item" aria-label={product.title}>
                <HangerHook className="lx-kept__hook" />
                <span className="lx-kept__photo">
                  <Image src={productImageUrl(product.imagePath!)} alt="" fill unoptimized sizes="2.25rem" className="object-cover" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
