import { useTranslations } from "next-intl";
import { MessagePage } from "@/components/layout/message-page";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("errors");
  const common = useTranslations("common");

  return (
    <main className="flex flex-1 flex-col pt-10">
      <MessagePage title={t("notFoundTitle")} body={t("notFoundBody")}>
        <Button asChild>
          <Link href="/">{common("backHome")}</Link>
        </Button>
      </MessagePage>
    </main>
  );
}
