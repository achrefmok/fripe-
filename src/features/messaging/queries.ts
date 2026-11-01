import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listConversations(shopId?: string, clientId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_conversations");

  if (error) throw error;

  return data.filter(
    (conversation) =>
      (!shopId || conversation.shop_id === shopId) &&
      (!clientId || conversation.client_id === clientId),
  );
}

export async function getConversation(conversationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, shop_id, client_id, client_name, closed_at, shops (name, slug)")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [messages, blocks] = await Promise.all([
    supabase
      .from("messages")
      .select("id, body, sender_side, created_at, product_id, products (title)")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(100),
    data.client_id
      ? supabase
          .from("user_blocks")
          .select("blocked_by")
          .eq("client_id", data.client_id)
          .eq("shop_id", data.shop_id)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    ...data,
    messages: [...(messages.data ?? [])].reverse(),
    blockedBy: blocks.data?.map((block) => block.blocked_by) ?? [],
  };
}

export async function getBlockSides(clientId: string, shopId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_by")
    .eq("client_id", clientId)
    .eq("shop_id", shopId);

  return data?.map((block) => block.blocked_by) ?? [];
}

export async function listMyBlockedShops(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_blocks")
    .select("shop_id, created_at, shops (name, slug)")
    .eq("client_id", clientId)
    .eq("blocked_by", "client")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function listShopBlockedClients(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_blocks")
    .select("client_id, client_name, created_at")
    .eq("shop_id", shopId)
    .eq("blocked_by", "shop")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}
