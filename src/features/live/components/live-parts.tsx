"use client";

import { Eye, EyeOff, ExternalLink, SendHorizontal, ShoppingBag } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addToCart } from "@/features/orders/actions";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils/price";
import { moderateLiveComment, postLiveComment } from "../actions";
import type { LiveComment, LiveProduct } from "../queries";

export function LiveBadge({ label }: { label: string }) {
  return (
    <span className="live-badge">
      <span className="live-badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

// Le fil du direct. Il reste collé en bas tant qu'on n'est pas remonté lire ; la boutique peut
// masquer un commentaire, qui disparaît alors pour tout le monde sauf pour elle.
export function LiveComments({
  liveId,
  comments,
  open,
  signedIn,
  canModerate = false,
  next,
  onPosted,
}: {
  liveId: string;
  comments: LiveComment[];
  open: boolean;
  signedIn: boolean;
  canModerate?: boolean;
  next: string;
  onPosted?: () => void;
}) {
  const t = useTranslations("live");
  const errors = useTranslations("errors");
  const feed = useRef<HTMLOListElement>(null);
  const pinned = useRef(true);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const last = comments.at(-1)?.id;

  useEffect(() => {
    const element = feed.current;
    if (element && pinned.current) element.scrollTop = element.scrollHeight;
  }, [last]);

  function send() {
    const text = body.trim();
    if (!text) return;

    startTransition(async () => {
      const result = await postLiveComment(liveId, text);
      if (result.ok) {
        setBody("");
        pinned.current = true;
        onPosted?.();
      } else {
        toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
      }
    });
  }

  function moderate(comment: LiveComment) {
    startTransition(async () => {
      const result = await moderateLiveComment(comment.id, !comment.hidden);
      if (result.ok) onPosted?.();
      else toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
    });
  }

  return (
    <section className="live-chat" aria-label={t("commentsTitle")}>
      <ol
        ref={feed}
        className="live-chat__feed"
        role="log"
        aria-live="polite"
        tabIndex={0}
        onScroll={(event) => {
          const element = event.currentTarget;
          pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
        }}
      >
        {comments.length ? (
          comments.map((comment) => (
            <li key={comment.id} className={cn("live-chat__item", comment.hidden && "is-hidden")}>
              <p className="min-w-0 flex-1" dir="auto">
                <span className="live-chat__name">{comment.authorName}</span> {comment.body}
                {comment.hidden ? <span className="live-chat__flag">{t("commentHidden")}</span> : null}
              </p>
              {canModerate ? (
                <button
                  type="button"
                  className="live-chat__mod"
                  aria-label={t(comment.hidden ? "commentShow" : "commentHide", { name: comment.authorName })}
                  onClick={() => moderate(comment)}
                  disabled={pending}
                >
                  {comment.hidden ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                </button>
              ) : null}
            </li>
          ))
        ) : (
          <li className="live-chat__empty">{open ? t("commentsEmpty") : t("commentsClosed")}</li>
        )}
      </ol>

      {open ? (
        signedIn ? (
          <form
            className="live-chat__form"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input
              type="text"
              value={body}
              maxLength={300}
              enterKeyHint="send"
              autoComplete="off"
              aria-label={t("commentLabel")}
              placeholder={t("commentPlaceholder")}
              className="live-chat__input"
              onChange={(event) => setBody(event.target.value)}
            />
            <button type="submit" className="live-chat__send" aria-label={t("commentSend")} disabled={pending || !body.trim()}>
              <SendHorizontal className="size-[18px] rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </form>
        ) : (
          <Link href={{ pathname: "/connexion", query: { next } }} className="live-chat__signin">{t("signInToComment")}</Link>
        )
      ) : null}
    </section>
  );
}

// Une pièce du Live, en vignette : photo, prix, et l'action qui convient (détails ou mise en avant).
export function LiveProductRow({
  product,
  pinned = false,
  pinnedLabel,
  onOpen,
  children,
}: {
  product: LiveProduct;
  pinned?: boolean;
  pinnedLabel: string;
  onOpen?: () => void;
  children?: React.ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations("live");

  const body = (
    <>
      <span className="live-piece__photo">
        {product.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="4rem" className="object-cover" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-start">
        {pinned ? <span className="live-piece__flag">{pinnedLabel}</span> : null}
        <span className="truncate text-sm font-medium" dir="auto">{product.title}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-lg leading-tight">{formatPrice(product.priceMillimes, locale)}</span>
          {product.size ? <span className="text-xs opacity-70" dir="ltr">{t("sizeShort", { size: product.size })}</span> : null}
          {product.available ? null : <span className="text-xs opacity-70">{t("soldOut")}</span>}
        </span>
      </span>
    </>
  );

  return (
    <div className={cn("live-piece", pinned && "is-pinned")}>
      {onOpen ? (
        <button type="button" className="live-piece__main" onClick={onOpen} aria-label={`${t("details")} : ${product.title}`}>
          {body}
        </button>
      ) : (
        <div className="live-piece__main">{body}</div>
      )}
      {children}
    </div>
  );
}

// Les détails d'une pièce, sans quitter le direct : la feuille monte du bas, la vidéo continue.
export function LiveProductSheet({
  product,
  onClose,
  signedIn,
  next,
}: {
  product: LiveProduct | null;
  onClose: () => void;
  signedIn: boolean;
  next: string;
}) {
  const t = useTranslations("live");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<string[]>([]);

  function add(productId: string) {
    if (!signedIn) {
      toast(t("signInToBuy"), { action: { label: t("signIn"), onClick: () => router.push({ pathname: "/connexion", query: { next } }) } });
      return;
    }

    startTransition(async () => {
      const result = await addToCart(productId);
      if (result.ok) {
        setAdded((list) => [...list, productId]);
        toast.success(t("added"), { action: { label: t("openCart"), onClick: () => router.push("/panier") } });
      } else {
        toast.error(t("addFailed"));
      }
    });
  }

  return (
    <Sheet open={Boolean(product)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="bottom" className="live-sheet">
        {product ? (
          <>
            <SheetHeader className="px-5 pt-5 pb-0">
              <SheetTitle className="font-display text-2xl font-normal" dir="auto">{product.title}</SheetTitle>
              <SheetDescription className="sr-only">{t("details")}</SheetDescription>
            </SheetHeader>
            <div className="live-sheet__body">
              <span className="live-sheet__photo">
                {product.imageUrl ? <Image src={product.imageUrl} alt={product.title} fill sizes="12rem" className="object-cover" /> : null}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {product.brand ? <p className="luxe-kicker" dir="auto">{product.brand}</p> : null}
                <p className="font-display text-3xl leading-none text-goldink">{formatPrice(product.priceMillimes, locale)}</p>
                <p className="text-sm text-muted-foreground">
                  {[product.size ? t("sizeShort", { size: product.size }) : null, product.condition ? conditions(product.condition) : null].filter(Boolean).join(" · ")}
                </p>
                <button
                  type="button"
                  className="live-sheet__buy"
                  onClick={() => add(product.id)}
                  disabled={pending || !product.available || added.includes(product.id)}
                >
                  <ShoppingBag className="size-[18px]" aria-hidden="true" />
                  {!product.available ? t("soldOut") : added.includes(product.id) ? t("added") : t("addToCart")}
                </button>
                <Link href={`/produit/${product.id}`} target="_blank" rel="noreferrer" className="live-sheet__link">
                  {t("openProduct")}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
