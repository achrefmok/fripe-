import { getTranslations } from "next-intl/server";
import { ConversationList } from "@/features/messaging/components/conversation-list";
import { listConversations } from "@/features/messaging/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function ShopMessagesPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/messages">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [conversations, t] = await Promise.all([listConversations(shopId), getTranslations("messaging")]);

  if (!conversations.length) {
    return <p className="text-muted-foreground">{t("emptyShop")}</p>;
  }

  return (
    <div className="max-w-2xl">
      <ConversationList
        basePath={`/vendeur/boutique/${shopId}/messages`}
        conversations={conversations.map((conversation) => ({
          id: conversation.id,
          name: conversation.client_name,
          lastBody: conversation.last_body,
          lastMessageAt: conversation.last_message_at,
          unread: conversation.unread,
        }))}
      />
    </div>
  );
}
