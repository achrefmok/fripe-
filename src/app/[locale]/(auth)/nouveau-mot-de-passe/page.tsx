import { getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/auth-forms";
import { redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";

export default async function ResetPasswordPage() {
  if (!(await getViewer())) {
    return redirect({ href: "/lien-invalide", locale: await getLocale() });
  }

  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("resetTitle")} lead={t("resetLead")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
