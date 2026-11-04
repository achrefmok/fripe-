"use server";

import type { AuthError } from "@supabase/supabase-js";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { getPathname, redirect } from "@/i18n/navigation";
import { getSiteUrl } from "@/lib/env";
import { processAccountDeletions, processStoragePurge } from "@/lib/maintenance";
import { getViewer } from "@/lib/permissions/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
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
  emailCodeSchema,
  forgotPasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  verifyEmailCodeSchema,
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

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
        locale,
        phone: parsed.data.phone,
        governorate_id: parsed.data.governorateId,
        city_id: parsed.data.governorateId ? parsed.data.cityId : null,
        address_line: parsed.data.addressLine,
      },
      emailRedirectTo: await absoluteUrl("/compte"),
    },
  });

  if (error) return authFailure(error);

  // Sans confirmation obligatoire, la session est ouverte tout de suite. Si le projet demande encore
  // une confirmation, la page d'attente reste le chemin.
  return redirect({ href: data.session ? "/compte" : "/verification-email", locale });
}

export async function signIn(input: unknown, next: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  let { data: signedIn, error } = await supabase.auth.signInWithPassword(parsed.data);

  // La confirmation d'e-mail n'est plus exigée. Supabase ne renvoie cette erreur qu'après avoir validé
  // le mot de passe : le compte, créé avant ce choix, est confirmé puis la connexion est relancée.
  if (error?.code === "email_not_confirmed") {
    const accounts = createAdminClient();
    const { data: found } = await accounts.auth.admin.listUsers({ perPage: 1000 });
    const user = found?.users.find((candidate) => candidate.email === parsed.data.email);
    if (user && !user.email_confirmed_at) {
      await accounts.auth.admin.updateUserById(user.id, { email_confirm: true });
      ({ data: signedIn, error } = await supabase.auth.signInWithPassword(parsed.data));
    }
  }

  if (error) return authFailure(error);
  if (!signedIn.user) return failure("unexpected");

  return completeSignIn(supabase, signedIn.user.id, next);
}

// Envoie un code de connexion. Sans compte pour cette adresse, il est créé à la première connexion :
// pas de formulaire d'inscription. La réponse est la même que l'adresse soit connue ou non.
export async function requestEmailCode(input: unknown): Promise<ActionResult> {
  const parsed = emailCodeSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const locale = await getLocale();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: true,
      data: { locale },
      emailRedirectTo: await absoluteUrl("/compte"),
    },
  });

  // Supabase impose un délai entre deux codes pour une même adresse (une minute par défaut).
  if (error?.code === "over_email_send_rate_limit" || error?.code === "over_request_rate_limit") {
    return failure("codeTooSoon");
  }
  if (error && error.code !== "user_banned") {
    console.error("Envoi d'un code de connexion", { code: error.code, status: error.status });
    return failure("unexpected");
  }

  return success();
}

export async function verifyEmailCode(input: unknown, next: unknown): Promise<ActionResult> {
  const parsed = verifyEmailCodeSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: "email",
  });

  if (error?.code === "over_request_rate_limit") return failure("tooManyAttempts");
  if (error || !data.user) return failure("emailCodeWrong");

  return completeSignIn(supabase, data.user.id, next);
}

// Fin commune des connexions : un administrateur passe toujours par le second facteur.
async function completeSignIn(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, next: unknown) {
  const destination = safeInternalPath(next);
  const { data: adminRow } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
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
      governorate_id: parsed.data.governorateId,
      city_id: parsed.data.governorateId ? parsed.data.cityId : null,
      address_line: parsed.data.addressLine,
    })
    .eq("id", viewer.id)
    .select("id");

  if (error) {
    if (error.message === "invalid_city") return failure("invalidInput", { cityId: "invalid_city" });
    console.error("Mise à jour du profil", { code: error.code });
    return failure("unexpected");
  }

  if (!data?.length) return failure("forbidden");

  revalidatePath("/[locale]/compte", "layout");
  return success();
}
