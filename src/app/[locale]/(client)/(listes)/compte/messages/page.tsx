import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { ConversationList } from "@/features/messaging/components/conversation-list";
import { listConversations } from "@/features/messaging/queries";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function MessagesPage() {
  const viewer = await requireViewer("/compte/messages");
  const [conversations, t] = await Promise.all([
    listConversations(undefined, viewer.id),
    getTranslations("messaging"),
  ]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <div className="mt-6">
        {conversations.length ? (
          <ConversationList
            basePath="/compte/messages"
            conversations={conversations.map((conversation) => ({
              id: conversation.id,
              name: conversation.shop_name,
              lastBody: conversation.last_body,
              lastMessageAt: conversation.last_message_at,
              unread: conversation.unread,
            }))}
          />
        ) : (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
      </div>
    </>
  );
}
