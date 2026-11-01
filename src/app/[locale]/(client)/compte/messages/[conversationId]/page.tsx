import { notFound } from "next/navigation";
import { Thread } from "@/features/messaging/components/thread";
import { getConversation } from "@/features/messaging/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function ConversationPage({
  params,
}: PageProps<"/[locale]/compte/messages/[conversationId]">) {
  const { conversationId } = await params;
  const viewer = await requireViewer(`/compte/messages/${conversationId}`);

  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
    notFound();
  }

  const conversation = await getConversation(conversationId);

  if (!conversation || conversation.client_id !== viewer.id) {
    notFound();
  }

  return (
    <>
      <h1 className="mb-3 font-display text-3xl font-extrabold">
        <Link href={`/boutique/${conversation.shops?.slug}`}>{conversation.shops?.name}</Link>
      </h1>
      <Thread
        conversationId={conversation.id}
        side="client"
        initialMessages={conversation.messages}
        closed={Boolean(conversation.closed_at)}
        blockedBy={conversation.blockedBy}
      />
    </>
  );
}
