import { getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/auth-forms";
import { redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signUp") };
}

export default async function SignUpPage() {
  if (await getViewer()) {
    return redirect({ href: "/compte", locale: await getLocale() });
  }

  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("signUpTitle")} lead={t("signUpLead")}>
      <SignUpForm />
    </AuthCard>
  );
}
