"use server";

import type { AuthError } from "@supabase/supabase-js";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { getPathname, redirect } from "@/i18n/navigation";
import { getSiteUrl } from "@/lib/env";
import { processAccountDeletions, processStoragePurge } from "@/lib/maintenance";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import {
  failure,
  rpcFailure,
  success,
  validationFailure,
  type ActionResult,
} from "@/lib/utils/action-result";
import { safeInternalPath } from "@/lib/utils/safe-path";
import {
  deleteAccountSchema,
  forgotPasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

function authFailure(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials":
      return failure("invalidCredentials");
    case "email_not_confirmed":
      return failure("emailNotConfirmed");
    case "weak_password":
      return failure("weakPassword");
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return failure("tooManyAttempts");
    default:
      console.error("Erreur d'authentification", { code: error.code, status: error.status });
      return failure("unexpected");
  }
}

async function absoluteUrl(href: string) {
  const locale = await getLocale();
  return new URL(getPathname({ href, locale }), getSiteUrl()).toString();
}

export async function signUp(input: unknown): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const locale = await getLocale();
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName, locale },
      emailRedirectTo: await absoluteUrl("/compte"),
    },
  });

  if (error) return authFailure(error);

  return redirect({ href: "/verification-email", locale });
}

export async function signIn(input: unknown, next: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data: signedIn, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return authFailure(error);

  const destination = safeInternalPath(next);
  const { data: adminRow } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", signedIn.user.id)
    .maybeSingle();

  // Un administrateur complète toujours sa connexion par le second facteur.
  if (adminRow) {
    return redirect({
      href: { pathname: "/verification-mfa", query: { next: destination } },
      locale: await getLocale(),
    });
  }

  return redirect({ href: destination, locale: await getLocale() });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/", locale: await getLocale() });
}

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await absoluteUrl("/nouveau-mot-de-passe"),
  });

  // Même réponse que le compte existe ou non, sauf limitation de débit.
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return failure("tooManyAttempts");
  }

  return success();
}

export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return failure("sessionExpired");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return authFailure(error);

  return redirect({ href: "/compte", locale: await getLocale() });
}

export async function deleteAccount(input: unknown): Promise<ActionResult> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await getViewer();
  if (!viewer?.email) return failure("sessionExpired");

  const supabase = await createClient();

  // Une session restée ouverte sur un téléphone prêté ne suffit pas à effacer un compte.
  const { error: passwordError } = await supabase.auth.signInWithPassword({
    email: viewer.email,
    password: parsed.data.password,
  });

  if (passwordError) return authFailure(passwordError);

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return rpcFailure(error);

  await Promise.all([processStoragePurge(), processAccountDeletions()]).catch(() =>
    console.error("Finalisation d'une suppression de compte"),
  );

  await supabase.auth.signOut({ scope: "local" });

  return redirect({ href: "/", locale: await getLocale() });
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      phone: parsed.data.phone,
      locale: parsed.data.locale,
    })
    .eq("id", viewer.id)
    .select("id");

  if (error) {
    console.error("Mise à jour du profil", { code: error.code });
    return failure("unexpected");
  }

  if (!data?.length) return failure("forbidden");

  revalidatePath("/[locale]/compte", "layout");
  return success();
}
