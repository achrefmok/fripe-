import { useTranslations } from "next-intl";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/auth-forms";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard title={t("forgotTitle")} lead={t("forgotLead")}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
