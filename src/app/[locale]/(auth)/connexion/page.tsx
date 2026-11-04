import { getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { SignInForm } from "@/features/auth/components/auth-forms";
import { redirect } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";
import { safeInternalPath } from "@/lib/utils/safe-path";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

export default async function SignInPage({ searchParams }: PageProps<"/[locale]/connexion">) {
  const { next, methode } = await searchParams;
  const destination = safeInternalPath(next);

  if (await getViewer()) {
    return redirect({ href: destination, locale: await getLocale() });
  }

  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("signInTitle")} lead={t("signInLead")}>
      <SignInForm next={destination} initialMethod={methode === "code" ? "code" : "password"} />
    </AuthCard>
  );
}
