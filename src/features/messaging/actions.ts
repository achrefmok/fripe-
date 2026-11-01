"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, type ActionResult } from "@/lib/utils/action-result";
import type { ThreadMessage } from "./components/thread";

const bodySchema = z.string().trim().min(1, "message_invalid").max(1000, "message_invalid");

export async function startConversation(input: {
  shopId: string;
  productId?: string;
  requestId?: string;
  body: string;
}): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = z
    .object({
      shopId: z.uuid(),
      productId: z.uuid().optional(),
      requestId: z.uuid().optional(),
      body: bodySchema,
    })
    .safeParse(input);

  if (!parsed.success) return failure("message_invalid");
  if (!(await getViewer())) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", {
    p_shop_id: parsed.data.shopId,
    p_product_id: (parsed.data.productId ?? null) as string,
    p_request_id: (parsed.data.requestId ?? null) as string,
    p_body: parsed.data.body,
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/messages", "page");
  return success({ conversationId: data });
}

export async function contactRequestClient(
  requestId: string,
  body: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return failure("message_invalid");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contact_request_client", {
    p_request_id: requestId,
    p_body: parsed.data,
  });

  if (error) return rpcFailure(error);

  return success({ conversationId: data });
}

export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<ActionResult<ThreadMessage | null>> {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return failure("message_invalid");

  const supabase = await createClient();
  const { data: messageId, error } = await supabase.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: parsed.data,
  });

  if (error) return rpcFailure(error);

  const { data: message } = await supabase
    .from("messages")
    .select("id, body, sender_side, created_at, product_id, products (title)")
    .eq("id", messageId)
    .maybeSingle();

  return success(message);
}

// Filet de sécurité du temps réel : un message manqué (réseau mobile, canal en cours
// d'ouverture) finit toujours par arriver. La lecture reste soumise à RLS.
export async function fetchMessagesSince(
  conversationId: string,
  since: string,
): Promise<ActionResult<ThreadMessage[]>> {
  if (!z.uuid().safeParse(conversationId).success || Number.isNaN(Date.parse(since))) {
    return failure("invalidInput");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, body, sender_side, created_at, product_id, products (title)")
    .eq("conversation_id", conversationId)
    .gt("created_at", since)
    .order("created_at")
    .limit(50);

  if (error) return rpcFailure(error);

  return success(data);
}

export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });

  return error ? rpcFailure(error) : success();
}

function revalidateBlocks() {
  revalidatePath("/[locale]/compte", "layout");
  revalidatePath("/[locale]/vendeur", "layout");
  revalidatePath("/[locale]/boutique/[slug]", "page");
}

export async function setShopBlocked(shopId: string, blocked: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(shopId).success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("block_shop", { p_shop_id: shopId, p_block: blocked });

  if (error) return rpcFailure(error);

  revalidateBlocks();
  return success();
}

export async function setClientBlocked(
  shopId: string,
  clientId: string,
  blocked: boolean,
): Promise<ActionResult> {
  if (!z.uuid().safeParse(shopId).success || !z.uuid().safeParse(clientId).success) {
    return failure("not_found");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("block_client", {
    p_shop_id: shopId,
    p_client_id: clientId,
    p_block: blocked,
  });

  if (error) return rpcFailure(error);

  revalidateBlocks();
  return success();
}

export async function setConversationBlocked(
  conversationId: string,
  blocked: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_conversation", {
    p_conversation_id: conversationId,
    p_block: blocked,
  });

  if (error) return rpcFailure(error);

  revalidateBlocks();
  return success();
}
