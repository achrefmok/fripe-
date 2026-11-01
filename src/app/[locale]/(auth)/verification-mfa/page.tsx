import { getLocale, getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { AuthCard } from "@/features/auth/components/auth-card";
import { MfaChallenge } from "@/features/auth/components/mfa-forms";
import { redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/utils/safe-path";

export async function generateMetadata() {
  const t = await getTranslations("mfa");
  return { title: t("title") };
}

export default async function MfaPage({ searchParams }: PageProps<"/[locale]/verification-mfa">) {
  const { next } = await searchParams;
  const destination = safeInternalPath(next);
  const [viewer, locale, t] = await Promise.all([getViewer(), getLocale(), getTranslations("mfa")]);

  if (!viewer) {
    return redirect({ href: { pathname: "/connexion", query: { next: destination } }, locale });
  }

  if (!viewer.isAdmin || viewer.aal === "aal2") {
    return redirect({ href: destination, locale });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp[0];

  // Un administrateur sans facteur ne s'en crée pas un ici : le mot de passe seul ne doit jamais
  // suffire à prendre la place du titulaire. Le rôle se réattribue par la procédure opérateur.
  return (
    <AuthCard title={factor ? t("title") : t("noFactorTitle")} lead={factor ? t("lead") : t("noFactorLead")}>
      {factor ? <MfaChallenge factorId={factor.id} next={destination} /> : null}
      <div className="mt-4 -ms-3">
        <SignOutButton />
      </div>
    </AuthCard>
  );
}
