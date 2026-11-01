"use client";

import { Heart, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleFavorite } from "@/features/catalog/actions";
import { addToCart } from "@/features/orders/actions";
import { cancelReservation, reserveProduct } from "@/features/reservations/actions";
import { Link, useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/utils/action-result";
import { formatDateTime, formatDuration } from "@/lib/utils/format";

type ProductActionsProps = {
  productId: string;
  title: string;
  status: "available" | "reserved" | "sold";
  signedIn: boolean;
  isFavorite: boolean;
  inCart: boolean;
  reservation: { id: string; expires_at: string } | null;
  ttlMinutes: number;
};

export function ProductActions({
  productId,
  title,
  status,
  signedIn,
  isFavorite,
  inCart,
  reservation,
  ttlMinutes,
}: ProductActionsProps) {
  const t = useTranslations("product");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [favorite, setFavorite] = useState(isFavorite);

  const signInHref = {
    pathname: "/connexion",
    query: { next: `/produit/${productId}` },
  };

  function run(action: () => Promise<ActionResult>, onDone: () => void) {
    startTransition(async () => {
      const result = await action();

      if (result.ok) {
        onDone();
      } else if (result.error === "sessionExpired") {
        router.push(signInHref);
      } else {
        toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
        router.refresh();
      }
    });
  }

  function share() {
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({ title, url }).catch(() => undefined);
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success(t("linkCopied")));
    }
  }

  const buyable = status === "available" || Boolean(reservation);

  return (
    <div className="grid gap-3">
      {reservation ? (
        <div className="bg-secondary px-4 py-3 text-sm">
          <p className="font-semibold">
            {t("reservedByYou", { time: formatDateTime(reservation.expires_at, locale) })}
          </p>
          <button
            type="button"
            disabled={pending}
            className="mt-1 font-medium underline underline-offset-4"
            onClick={() =>
              run(
                () => cancelReservation(reservation.id),
                () => {
                  toast.success(t("reservationCancelled"));
                  router.refresh();
                },
              )
            }
          >
            {t("cancelReservation")}
          </button>
        </div>
      ) : null}

      {status === "sold" ? (
        <div className="bg-secondary px-4 py-3">
          <p className="font-semibold">{t("soldTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("soldBody")}</p>
        </div>
      ) : null}

      {status === "reserved" && !reservation ? (
        <div className="bg-secondary px-4 py-3">
          <p className="font-semibold">{t("reservedTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("reservedBody")}</p>
        </div>
      ) : null}

      {buyable && !signedIn ? (
        <Button asChild size="lg" className="h-auto min-h-12 whitespace-normal text-center">
          <Link href={signInHref}>{t("signInToAct")}</Link>
        </Button>
      ) : null}

      {buyable && signedIn ? (
        <>
          <Button
            size="lg"
            disabled={pending}
            onClick={() =>
              run(
                () => addToCart(productId),
                () => router.push("/commande"),
              )
            }
          >
            {t("buy")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {inCart ? (
              <Button asChild variant="outline">
                <Link href="/panier">{t("goToCart")}</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => addToCart(productId),
                    () => {
                      toast.success(t("addedToCart"));
                      router.refresh();
                    },
                  )
                }
              >
                {t("addToCart")}
              </Button>
            )}
            {reservation ? null : (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => reserveProduct(productId),
                    () => {
                      toast.success(t("reservationDone"));
                      router.refresh();
                    },
                  )
                }
              >
                {t("reserve")}
              </Button>
            )}
          </div>
          {reservation ? null : (
            <p className="text-sm text-muted-foreground">{t("reserveHint", { duration: formatDuration(ttlMinutes, locale) })}</p>
          )}
        </>
      ) : null}

      <div className="flex gap-1">
        {signedIn ? (
          <Button
            variant="ghost"
            disabled={pending}
            aria-pressed={favorite}
            onClick={() =>
              run(
                async () => {
                  const result = await toggleFavorite(productId);
                  if (result.ok) setFavorite(result.data.favorite);
                  return result.ok ? { ok: true, data: undefined } : result;
                },
                () => undefined,
              )
            }
          >
            <Heart className={favorite ? "fill-harissa text-harissa" : ""} />
            {favorite ? t("unfavorite") : t("favorite")}
          </Button>
        ) : null}
        <Button variant="ghost" onClick={share}>
          <Share2 />
          {t("share")}
        </Button>
      </div>
    </div>
  );
}
