"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, success, validationFailure, type ActionResult } from "@/lib/utils/action-result";

const codeSchema = z.object({
  factorId: z.uuid(),
  code: z.string().trim().regex(/^[0-9]{6}$/, "mfaCodeInvalid"),
});

const nameSchema = z.string().trim().min(2, "nameTooShort").max(40, "nameTooLong");

async function adminViewer() {
  const viewer = await getViewer();
  return viewer?.isAdmin && viewer.status === "active" ? viewer : null;
}

// Un futur administrateur s'inscrit avant de recevoir le rôle : aucun rôle sans facteur vérifié.
async function activeViewer() {
  const viewer = await getViewer();
  return viewer?.status === "active" ? viewer : null;
}

// Un enrôlement abandonné laisse un facteur non vérifié, sans valeur : on repart de zéro.
async function dropUnverifiedFactors(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.auth.mfa.listFactors();

  for (const factor of data?.all ?? []) {
    if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
}

export async function startMfaEnrollment(
  name: unknown,
): Promise<ActionResult<{ factorId: string; qrCode: string; secret: string }>> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return failure(parsed.error.issues[0].message);

  if (!(await activeViewer())) return failure("forbidden");

  const supabase = await createClient();
  await dropUnverifiedFactors(supabase);

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: parsed.data,
    issuer: "FRIPE",
  });

  if (error) {
    console.error("Enrôlement MFA", { code: error.code, status: error.status });
    return failure(error.code === "mfa_factor_name_conflict" ? "mfaNameTaken" : "unexpected");
  }

  return success({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
}

async function verifyCode(input: unknown) {
  const parsed = codeSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);

  if (error) {
    if (error.code === "mfa_verification_failed") return failure("mfaCodeWrong");
    if (error.status === 429) return failure("tooManyAttempts");

    console.error("Vérification MFA", { code: error.code, status: error.status });
    return failure("unexpected");
  }

  return success();
}

export async function confirmMfaEnrollment(input: unknown): Promise<ActionResult> {
  const viewer = await activeViewer();
  if (!viewer) return failure("forbidden");

  const result = await verifyCode(input);
  if (!result.ok) return result;

  if (viewer.isAdmin) {
    const supabase = await createClient();
    await supabase.rpc("log_mfa_event", { p_action: "mfa.enrolled" });
  }

  revalidatePath("/[locale]/compte/securite", "page");
  revalidatePath("/[locale]/preparation-admin", "page");
  return success();
}

export async function verifyMfa(input: unknown): Promise<ActionResult> {
  if (!(await activeViewer())) return failure("forbidden");

  return verifyCode(input);
}

export async function removeMfaFactor(factorId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(factorId).success) return failure("not_found");

  const viewer = await adminViewer();
  if (!viewer || viewer.aal !== "aal2") return failure("forbidden");

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data?.totp ?? [];

  if (!verified.some((factor) => factor.id === factorId)) return failure("not_found");
  if (verified.length <= 1) return failure("mfaLastFactor");

  const { error } = await supabase.auth.mfa.unenroll({ factorId });

  if (error) {
    console.error("Retrait MFA", { code: error.code, status: error.status });
    return failure("unexpected");
  }

  await supabase.rpc("log_mfa_event", { p_action: "mfa.removed" });

  revalidatePath("/[locale]/compte/securite", "page");
  return success();
}
