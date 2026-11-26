import "server-only";
import { createClient } from "@/lib/supabase/server";

export const MEDIA_EVENTS_PAGE_SIZE = 30;
export const MEDIA_DECISIONS = ["block", "flag"] as const;
export type MediaDecisionFilter = (typeof MEDIA_DECISIONS)[number];

// Les rapports de modération des médias. Lecture réservée aux administrateurs par la RLS.
export async function listMediaEvents(page: number, decision: MediaDecisionFilter | null, userId: string | null) {
  const supabase = await createClient();
  const from = (page - 1) * MEDIA_EVENTS_PAGE_SIZE;

  let query = supabase
    .from("media_moderation_events")
    .select("id, user_id, media_kind, context, decision, category, severity, reason, ai_signals, provider, sanction, attempts_30d, sha256, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + MEDIA_EVENTS_PAGE_SIZE - 1);

  if (decision) query = query.eq("decision", decision);
  if (userId) query = query.eq("user_id", userId);

  const { data, count, error } = await query;
  if (error) throw error;

  const userIds = [...new Set(data.map((event) => event.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, display_name, status").in("id", userIds)
    : { data: [] };
  const byId = new Map(profiles?.map((profile) => [profile.id, profile]));

  return {
    events: data.map((event) => ({
      ...event,
      accountName: byId.get(event.user_id)?.display_name ?? null,
      accountStatus: byId.get(event.user_id)?.status ?? null,
    })),
    total: count ?? 0,
  };
}

export async function countBlockedMedia(days = 7) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("media_moderation_events")
    .select("id", { count: "exact", head: true })
    .eq("decision", "block")
    .gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString());
  return count ?? 0;
}
