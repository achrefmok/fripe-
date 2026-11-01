import { NextResponse } from "next/server";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";

// Pages publiques statiques : les compteurs personnels sont chargés à part, jamais mis en cache.
export async function GET() {
  const viewer = await getViewer();

  if (!viewer) {
    return NextResponse.json({ total: 0 }, { headers: { "Cache-Control": "no-store" } });
  }

  const supabase = await createClient();

  const [conversations, notifications] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", viewer.id)
      .is("read_at", null),
  ]);

  const messages = conversations.data?.reduce((sum, conversation) => sum + conversation.unread, 0) ?? 0;
  const alerts = notifications.count ?? 0;

  return NextResponse.json(
    { messages, alerts, total: messages + alerts },
    { headers: { "Cache-Control": "no-store" } },
  );
}
