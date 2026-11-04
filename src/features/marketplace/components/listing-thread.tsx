"use client";

import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";
import { blockPerson, fetchListingMessagesSince, markListingThreadRead, sendListingMessage } from "../actions";

type Message = { id: string; body: string; created_at: string; mine: boolean };

const POLL_MS = 8000;

// Les nouveaux messages arrivent par sondage léger, seulement quand l'onglet est visible.
export function ListingThread({
  threadId,
  otherId,
  otherName,
  initialMessages,
  closed,
}: {
  threadId: string;
  otherId: string | null;
  otherName: string;
  initialMessages: Message[];
  closed: boolean;
}) {
  const t = useTranslations("market");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const last = useRef(initialMessages.at(-1)?.created_at ?? null);

  useEffect(() => {
    last.current = messages.at(-1)?.created_at ?? null;
    end.current?.scrollIntoView({ block: "end" });
    void markListingThreadRead(threadId);
  }, [messages, threadId]);

  useEffect(() => {
    if (closed) return;

    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const fresh = await fetchListingMessagesSince(threadId, last.current);
      if (fresh.length) setMessages((current) => [...current, ...fresh.filter((message) => !current.some((known) => known.id === message.id))]);
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [closed, threadId]);

  return (
    <div className="mt-5">
      <ol className="grid gap-2" aria-live="polite">
        {messages.map((message) => (
          <li key={message.id} className={cn("listing-bubble", message.mine && "listing-bubble--mine")}>
            <p className="break-words whitespace-pre-line">{message.body}</p>
            <time className="mt-1 block text-[0.7rem] opacity-70" dateTime={message.created_at}>
              {message.mine ? `${t("you")} · ` : ""}
              {formatDateTime(message.created_at, locale)}
            </time>
          </li>
        ))}
      </ol>
      <div ref={end} />

      {closed ? (
        <p className="mt-5 bg-secondary px-3 py-2 text-sm font-medium" role="status">{t("threadClosed")}</p>
      ) : (
        <form
          className="listing-composer"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const text = body;
            startTransition(async () => {
              const result = await sendListingMessage(threadId, text);
              if (!result.ok) {
                setError(result.fields ? Object.values(result.fields)[0] : result.error);
                return;
              }
              setBody("");
              const fresh = await fetchListingMessagesSince(threadId, last.current);
              setMessages((current) => [...current, ...fresh.filter((message) => !current.some((known) => known.id === message.id))]);
            });
          }}
        >
          <Label htmlFor="thread-body" className="sr-only">{t("messageLabel")}</Label>
          <Textarea
            id="thread-body"
            rows={2}
            maxLength={1000}
            value={body}
            placeholder={t("messagePlaceholder")}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-11 flex-1"
          />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={pending || !body.trim()} aria-label={t("send")}>
            <Send className="rtl:-scale-x-100" />
          </Button>
        </form>
      )}
      <FormError error={error} />

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
        <ReportDialog targetType="listing_thread" targetId={threadId} label={t("reportThread")} />
        {otherId && !closed ? (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setBlocking(true)}>
            {t("block")}
          </Button>
        ) : null}
      </div>

      <Dialog open={blocking} onOpenChange={setBlocking}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("blockTitle", { name: otherName })}</DialogTitle>
            <DialogDescription>{t("blockBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBlocking(false)}>{t("cancel")}</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await blockPerson(otherId!);
                  if (result.ok) {
                    toast.success(t("blocked"));
                    setBlocking(false);
                    router.refresh();
                  } else toast.error(errors.has(result.error) ? errors(result.error) : errors("unexpected"));
                })
              }
            >
              {t("blockConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
