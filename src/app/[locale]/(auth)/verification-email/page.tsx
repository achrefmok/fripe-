import { useTranslations } from "next-intl";
import { AuthCard } from "@/features/auth/components/auth-card";

export default function VerifyEmailPage() {
  const t = useTranslations("auth");

  return <AuthCard title={t("verifyTitle")} lead={t("verifyBody")} />;
}
