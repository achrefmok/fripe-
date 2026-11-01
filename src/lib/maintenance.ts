import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 10;

// La base inscrit le travail ; seule la clé secrète peut retirer un fichier ou une fiche
// d'authentification. Un échec reste en file et sera repris au prochain passage.
export async function processStoragePurge(limit = 200) {
  const admin = createAdminClient();
  const { data: items, error } = await admin.rpc("next_storage_purge", { p_limit: limit });

  if (error) throw error;

  let removed = 0;
  let failed = 0;

  for (const bucket of new Set(items.map((item) => item.bucket))) {
    const batch = items.filter((item) => item.bucket === bucket);
    const { error: removeError } = await admin.storage.from(bucket).remove(batch.map((item) => item.path));

    if (removeError) {
      console.error("Purge du Storage", { name: removeError.name, bucket });
      failed += batch.length;

      for (const item of batch) {
        await admin.from("storage_purge_queue").update({ attempts: item.attempts + 1 }).eq("id", item.id);
      }

      continue;
    }

    await admin
      .from("storage_purge_queue")
      .update({ done_at: new Date().toISOString(), outcome: "removed" })
      .in("id", batch.map((item) => item.id));

    removed += batch.length;
  }

  return { removed, failed };
}

export async function processAccountDeletions(limit = 50) {
  const admin = createAdminClient();
  const { data: items, error } = await admin
    .from("account_deletions")
    .select("user_id, attempts")
    .is("completed_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("requested_at")
    .limit(limit);

  if (error) throw error;

  let completed = 0;
  let failed = 0;

  for (const item of items) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(item.user_id);

    if (deleteError && deleteError.status !== 404) {
      console.error("Suppression de compte", { code: deleteError.code, status: deleteError.status });
      failed += 1;
      await admin.from("account_deletions").update({ attempts: item.attempts + 1 }).eq("user_id", item.user_id);
      continue;
    }

    await admin
      .from("account_deletions")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", item.user_id);

    completed += 1;
  }

  return { completed, failed };
}

export type MaintenanceResult =
  | { status: "skipped" }
  | { status: "succeeded" | "partial"; storage: { removed: number; failed: number }; accounts: { completed: number; failed: number } };

// Une seule exécution à la fois, quel que soit le nombre d'appels ou de serveurs.
export async function runMaintenance(): Promise<MaintenanceResult> {
  const admin = createAdminClient();
  const { data: run, error } = await admin.rpc("begin_maintenance_run");

  if (error) throw error;
  if (!run) return { status: "skipped" };

  try {
    const [storage, accounts] = await Promise.all([processStoragePurge(), processAccountDeletions()]);
    const status = storage.failed || accounts.failed ? "partial" : "succeeded";

    await admin.rpc("finish_maintenance_run", {
      p_run: run,
      p_status: status,
      p_result: { storage, accounts },
      p_error: "",
    });

    console.info("Maintenance", { status, storage, accounts });

    return { status, storage, accounts };
  } catch (failure) {
    const message = failure instanceof Error ? failure.name : "unknown";

    await admin.rpc("finish_maintenance_run", {
      p_run: run,
      p_status: "failed",
      p_result: {},
      p_error: message,
    });

    throw failure;
  }
}

const STALE_AFTER_MINUTES = 60;

export async function getMaintenanceHealth() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("maintenance_runs")
    .select("started_at")
    .eq("status", "succeeded")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const { count: stuckFiles } = await admin
    .from("storage_purge_queue")
    .select("id", { count: "exact", head: true })
    .is("done_at", null)
    .gte("attempts", MAX_ATTEMPTS);

  const { count: stuckAccounts } = await admin
    .from("account_deletions")
    .select("user_id", { count: "exact", head: true })
    .is("completed_at", null)
    .gte("attempts", MAX_ATTEMPTS);

  const ageMinutes = data ? Math.round((Date.now() - Date.parse(data.started_at)) / 60_000) : null;

  return {
    lastSuccessAt: data?.started_at ?? null,
    ageMinutes,
    stuckFiles: stuckFiles ?? 0,
    stuckAccounts: stuckAccounts ?? 0,
    stale: ageMinutes === null || ageMinutes > STALE_AFTER_MINUTES,
  };
}
