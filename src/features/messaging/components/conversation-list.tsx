import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/utils/format";

type Conversation = {
  id: string;
  name: string;
  lastBody: string | null;
  lastMessageAt: string;
  unread: number;
};

export function ConversationList({
  conversations,
  basePath,
}: {
  conversations: Conversation[];
  basePath: string;
}) {
  const t = useTranslations("messaging");
  const locale = useLocale();

  return (
    <ul className="divide-y border-y">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <Link href={`${basePath}/${conversation.id}`} className="flex items-center gap-3 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{conversation.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{conversation.lastBody}</span>
              <span className="block text-xs text-muted-foreground">
                {formatDateTime(conversation.lastMessageAt, locale)}
              </span>
            </span>
            {conversation.unread ? (
              <span className="bg-harissa px-2 py-0.5 text-xs font-bold text-harissa-ink">
                {t("unread", { count: conversation.unread })}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
