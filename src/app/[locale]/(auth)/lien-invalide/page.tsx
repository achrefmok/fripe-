import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/auth-card";
import { Link } from "@/i18n/navigation";

export default function InvalidLinkPage() {
  const t = useTranslations("auth");

  return (
    <AuthCard title={t("linkInvalidTitle")} lead={t("linkInvalidBody")}>
      <Button asChild>
        <Link href="/mot-de-passe-oublie">{t("forgotSubmit")}</Link>
      </Button>
    </AuthCard>
  );
}
