import { notFound } from "next/navigation";
import { Thread } from "@/features/messaging/components/thread";
import { getConversation } from "@/features/messaging/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function ShopConversationPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/messages/[conversationId]">) {
  const { shopId, conversationId } = await params;
  await requireShopAccess(shopId);

  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
    notFound();
  }

  const conversation = await getConversation(conversationId);

  if (!conversation || conversation.shop_id !== shopId) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-3 font-display text-2xl font-bold">{conversation.client_name}</h2>
      <Thread
        conversationId={conversation.id}
        side="shop"
        initialMessages={conversation.messages}
        closed={Boolean(conversation.closed_at)}
        blockedBy={conversation.blockedBy}
        clientId={conversation.client_id ?? undefined}
      />
    </div>
  );
}
