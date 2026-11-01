import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const ADMIN_PAGE_SIZE = 20;

type ShopStatus = Database["public"]["Enums"]["shop_status"];

export async function getAdminStats() {
  const supabase = await createClient();
  const countShops = (status: ShopStatus) =>
    supabase.from("shops").select("id", { count: "exact", head: true }).eq("status", status);

  const [pending, approved, users, suspended] = await Promise.all([
    countShops("pending"),
    countShops("approved"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
  ]);

  return {
    pendingShops: pending.count ?? 0,
    approvedShops: approved.count ?? 0,
    users: users.count ?? 0,
    suspendedUsers: suspended.count ?? 0,
  };
}

export async function listShops(status: ShopStatus | null, page: number) {
  const supabase = await createClient();
  const from = (page - 1) * ADMIN_PAGE_SIZE;

  let query = supabase
    .from("shops")
    .select(
      "id, name, slug, status, created_at, review_note, governorates (name_fr, name_ar), cities (name_fr, name_ar)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return { shops: data, total: count ?? 0 };
}

export async function listUsers(search: string, page: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: search,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_PAGE_SIZE,
  });

  if (error) throw error;

  return { users: data, total: data[0]?.total_count ?? 0 };
}

export async function listAuditLogs(page: number, action = "", entity = "") {
  const supabase = await createClient();
  const from = (page - 1) * ADMIN_PAGE_SIZE;

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE - 1);

  if (action) query = query.ilike("action", `%${action.replace(/[\\%_]/g, "\\$&")}%`);
  if (entity) query = query.eq("entity_id", entity);

  const { data, count, error } = await query;
  if (error) throw error;

  const actorIds = [...new Set(data.flatMap((log) => (log.actor_id ? [log.actor_id] : [])))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", actorIds)
    : { data: [] };

  const names = new Map(actors?.map((actor) => [actor.id, actor.display_name]));

  return {
    logs: data.map((log) => ({ ...log, actorName: log.actor_id ? names.get(log.actor_id) ?? null : null })),
    total: count ?? 0,
  };
}

export async function listAdminCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name_fr, name_ar, position, is_active")
    .order("position")
    .order("name_fr");

  if (error) throw error;

  return data;
}

export async function listAdminLocations() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("governorates")
    .select("id, name_fr, name_ar, cities (id, name_fr, name_ar, is_active)")
    .order("name_fr");

  if (error) throw error;

  return data.map((governorate) => ({
    ...governorate,
    cities: [...governorate.cities].sort((a, b) => a.name_fr.localeCompare(b.name_fr)),
  }));
}

export async function getModerationCounts() {
  const supabase = await createClient();
  const [reports, reviews] = await Promise.all([
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "hidden"),
  ]);

  return { openReports: reports.count ?? 0, hiddenReviews: reviews.count ?? 0 };
}

export async function listAdminVideos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("videos")
    .select("id, description, created_at, shops (name)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data;
}

export async function getLastMaintenance() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_runs")
    .select("status, started_at")
    .neq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
