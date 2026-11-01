import { getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { MfaChallenge, MfaEnroll } from "@/features/auth/components/mfa-forms";
import { redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";

// Étape préalable au rôle d'administrateur : voir docs/administration-mfa.md.
export default async function AdminPreparationPage() {
  const [viewer, locale, t] = await Promise.all([getViewer(), getLocale(), getTranslations("mfa")]);

  if (!viewer) {
    return redirect({ href: { pathname: "/connexion", query: { next: "/preparation-admin" } }, locale });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp[0];

  if (!factor) {
    return (
      <AuthCard title={t("prepareTitle")} lead={t("prepareLead")}>
        <MfaEnroll next="/preparation-admin" defaultName={t("defaultDevice")} />
      </AuthCard>
    );
  }

  if (viewer.aal !== "aal2") {
    return (
      <AuthCard title={t("title")} lead={t("lead")}>
        <MfaChallenge factorId={factor.id} next="/preparation-admin" />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("prepareDoneTitle")} lead={t("prepareDoneLead")}>
      <ul className="grid gap-2">
        {data?.totp.map((device) => (
          <li key={device.id}>
            <span className="block font-semibold">{device.friendly_name}</span>
            <code data-testid="mfa-fingerprint" dir="ltr" className="text-lg font-bold">{device.id.slice(0, 8)}</code>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">{t("prepareWarning")}</p>
    </AuthCard>
  );
}
