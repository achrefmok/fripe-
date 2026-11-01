import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ReportStatus = Database["public"]["Enums"]["report_status"];

export async function listReports(status: ReportStatus) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, details, snapshot, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data;
}

export async function listDecisions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_decisions")
    .select("id, decision, note, created_at, reports (target_type, snapshot)")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  return data;
}
