"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { processStoragePurge } from "@/lib/maintenance";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, validationFailure, type ActionResult } from "@/lib/utils/action-result";

const reportSchema = z.object({
  targetType: z.enum(["product", "video", "conversation", "shop", "account", "review", "listing", "listing_thread"]),
  targetId: z.uuid(),
  reason: z.enum(["counterfeit", "inappropriate", "scam", "harassment", "other"]),
  details: z.string().trim().max(500, "textTooLong"),
});

const decisionSchema = z.object({
  reportId: z.uuid(),
  decision: z.enum(["dismiss", "remove_content", "suspend"]),
  note: z.string().trim().min(3, "noteRequired").max(500, "noteTooLong"),
});

export async function createReport(input: unknown): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  if (!(await getViewer())) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_report", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details,
  });

  if (error) return rpcFailure(error);

  return success();
}

export async function reviewReport(
  reportId: string,
  decision: "dismiss" | "remove_content" | "suspend",
  note: string,
): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse({ reportId, decision, note });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_report", {
    p_report_id: parsed.data.reportId,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note,
  });

  if (error) return rpcFailure(error);

  // review_report a vérifié le rôle d'administrateur : la clé secrète n'est jamais atteinte avant.
  // Un échec ici ne remet pas la décision en cause : les fichiers restent en file.
  if (parsed.data.decision === "remove_content") {
    await processStoragePurge().catch(() => console.error("Purge après décision de modération"));
  }

  revalidatePath("/[locale]/admin", "layout");
  revalidatePath("/[locale]/walk", "page");
  return success();
}
