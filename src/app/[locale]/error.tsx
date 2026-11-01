"use client";

import { useTranslations } from "next-intl";
import { MessagePage } from "@/components/layout/message-page";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("errors");

  return (
    <main className="flex flex-1 flex-col pt-10">
      <MessagePage title={t("pageTitle")} body={t("pageBody")}>
        <Button onClick={reset}>{t("retry")}</Button>
      </MessagePage>
    </main>
  );
}
