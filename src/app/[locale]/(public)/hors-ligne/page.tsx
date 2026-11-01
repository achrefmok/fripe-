import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { MessagePage } from "@/components/layout/message-page";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function OfflinePage({ params }: PageProps<"/[locale]/hors-ligne">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("offline");

  return (
    <MessagePage title={t("title")} body={t("body")}>
      <Button asChild>
        <Link href="/">{t("retry")}</Link>
      </Button>
    </MessagePage>
  );
}
