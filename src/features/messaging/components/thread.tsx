"use client";

import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  fetchMessagesSince,
  markConversationRead,
  sendMessage,
  setConversationBlocked,
} from "@/features/messaging/actions";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/utils/format";

export type ThreadMessage = {
  id: string;
  body: string;
  sender_side: "client" | "shop";
  created_at: string;
  product_id?: string | null;
  products?: { title: string | null } | null;
};

export function Thread({
  conversationId,
  side,
  initialMessages,
  closed,
  blockedBy,
  clientId,
}: {
  conversationId: string;
  side: "client" | "shop";
  initialMessages: ThreadMessage[];
  closed: boolean;
  blockedBy: ("client" | "shop")[];
  clientId?: string;
}) {
  const t = useTranslations("messaging");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const lastSeen = useRef(initialMessages.at(-1)?.created_at);

  useEffect(() => {
    lastSeen.current = messages.at(-1)?.created_at;
    end.current?.scrollIntoView({ block: "end" });
    void markConversationRead(conversationId);
  }, [messages, conversationId]);

  // RLS s'applique aussi au temps réel : seuls les participants reçoivent ces événements.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const message = payload.new as ThreadMessage;
            setMessages((current) =>
              current.some((known) => known.id === message.id) ? current : [...current, message],
            );
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden || !lastSeen.current) return;

      const result = await fetchMessagesSince(conversationId, lastSeen.current);
      if (!result.ok || !result.data.length) return;

      setMessages((latest) => [
        ...latest,
        ...result.data.filter((message) => !latest.some((known) => known.id === message.id)),
      ]);
    }, 10_000);

    return () => clearInterval(timer);
  }, [conversationId]);

  const iBlocked = blockedBy.includes(side);
  const canSend = !closed && !blockedBy.length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setConversationBlocked(conversationId, !iBlocked);
              router.refresh();
            })
          }
        >
          {iBlocked ? t("unblock") : t("block")}
        </Button>
        <ReportDialog targetType="conversation" targetId={conversationId} />
        {clientId ? <ReportDialog targetType="account" targetId={clientId} label={t("reportClient")} /> : null}
      </div>

      <ol aria-live="polite" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {messages.map((message) => (
          <li
            key={message.id}
            className={cn(
              "max-w-[85%] px-3 py-2 text-sm",
              message.sender_side === side
                ? "justify-self-end bg-foreground text-background"
                : "justify-self-start bg-secondary",
            )}
          >
            {message.product_id && message.products?.title ? (
              <Link href={`/produit/${message.product_id}`} className="mb-1 block text-xs font-semibold underline underline-offset-2">
                {message.products.title}
              </Link>
            ) : null}
            <p className="whitespace-pre-line [overflow-wrap:anywhere]">{message.body}</p>
            <p className="mt-0.5 text-[0.7rem] opacity-70">{formatDateTime(message.created_at, locale)}</p>
          </li>
        ))}
      </ol>
      <div ref={end} />

      {closed ? <p className="text-sm text-muted-foreground">{t("closed")}</p> : null}
      {!closed && blockedBy.length ? <p className="text-sm text-muted-foreground">{t("blocked")}</p> : null}

      {canSend ? (
        <form
          className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] flex items-end gap-2 bg-background py-2 md:bottom-0"
          onSubmit={(event) => {
            event.preventDefault();
            if (!body.trim()) return;

            setError(null);

            startTransition(async () => {
              const result = await sendMessage(conversationId, body);

              if (result.ok) {
                setBody("");

                // Le temps réel peut arriver avant, après ou jamais : un seul exemplaire s'affiche.
                const sent = result.data;
                if (sent) {
                  setMessages((current) =>
                    current.some((known) => known.id === sent.id) ? current : [...current, sent],
                  );
                }
              } else {
                setError(errors.has(result.error) ? result.error : "unexpected");
              }
            });
          }}
        >
          <Input
            aria-label={t("placeholder")}
            placeholder={t("placeholder")}
            maxLength={1000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button type="submit" size="icon" aria-label={t("send")} disabled={pending || !body.trim()}>
            <Send className="rtl:-scale-x-100" />
          </Button>
        </form>
      ) : null}
      <FormError error={error} />
    </div>
  );
}
