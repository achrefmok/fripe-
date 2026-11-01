import { useTranslations } from "next-intl";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { AuthCard } from "@/features/auth/components/auth-card";

export default function SuspendedPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard title={t("suspendedTitle")} lead={t("suspendedBody")}>
      <SignOutButton />
    </AuthCard>
  );
}
