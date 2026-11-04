"use client";

import { Heart, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { contactSeller, deleteListing, setListingState, toggleListingFavorite } from "../actions";

export function FavoriteListingButton({ listingId, initial }: { listingId: string; initial: boolean }) {
  const t = useTranslations("market");
  const errors = useTranslations("errors");
  const [favorite, setFavorite] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 gap-2"
      aria-pressed={favorite}
      disabled={pending}
      onClick={() => {
        const next = !favorite;
        setFavorite(next);
        startTransition(async () => {
          const result = await toggleListingFavorite(listingId, next);
          if (!result.ok) {
            setFavorite(!next);
            toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
          }
        });
      }}
    >
      <Heart className={cn("size-4", favorite && "fill-harissa text-harissa")} />
      {favorite ? t("favoriteRemove") : t("favoriteAdd")}
    </Button>
  );
}

export function ContactSellerForm({ listingId }: { listingId: string }) {
  const t = useTranslations("market");
  const router = useRouter();
  const [body, setBody] = useState(t("contactPlaceholder"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await contactSeller(listingId, body);
          if (result.ok) router.push(`/compte/echanges/${result.data.threadId}`);
          else setError(result.fields ? Object.values(result.fields)[0] : result.error);
        });
      }}
    >
      <Label htmlFor="contact-body" className="font-display text-lg font-extrabold">
        {t("contactTitle")}
      </Label>
      <Textarea id="contact-body" value={body} maxLength={1000} rows={3} onChange={(event) => setBody(event.target.value)} />
      <FormError error={error} />
      <Button type="submit" className="h-11 gap-2" disabled={pending || !body.trim()}>
        <MessageCircle className="size-4" />
        {t("contactSend")}
      </Button>
    </form>
  );
}

type State = "available" | "reserved" | "sold" | "hidden" | "published";

export function OwnerListingActions({
  listingId,
  status,
  hidden,
  moderated,
  onDeletedHref = "/compte/annonces",
}: {
  listingId: string;
  status: "available" | "reserved" | "sold";
  hidden: boolean;
  moderated: boolean;
  onDeletedHref?: string;
}) {
  const t = useTranslations("market");
  const errors = useTranslations("errors");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        after?.();
        router.refresh();
      } else {
        toast.error(result.error && errors.has(result.error) ? errors(result.error) : errors("unexpected"));
      }
    });
  }

  const state = (next: State) => () => run(() => setListingState(listingId, next));

  return (
    <div className="flex flex-wrap gap-2">
      {!moderated ? (
        <>
          {status !== "sold" ? (
            <Button type="button" size="sm" disabled={pending} onClick={state("sold")}>
              {t("markSold")}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={state("available")}>
              {t("markAvailable")}
            </Button>
          )}
          {status === "available" ? (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={state("reserved")}>
              {t("markReserved")}
            </Button>
          ) : status === "reserved" ? (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={state("available")}>
              {t("markAvailable")}
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={state(hidden ? "published" : "hidden")}>
            {hidden ? t("show") : t("hide")}
          </Button>
        </>
      ) : null}
      <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => setConfirming(true)}>
        {t("delete")}
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>{t("deleteBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(
                  () => deleteListing(listingId),
                  () => {
                    setConfirming(false);
                    router.push(onDeletedHref);
                  },
                )
              }
            >
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
