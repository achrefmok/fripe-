import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { MessagePage } from "@/components/layout/message-page";
import { Button } from "@/components/ui/button";
import { getOrderGroup } from "@/features/orders/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function OrderConfirmationPage({
  params,
}: PageProps<"/[locale]/commande/confirmation/[groupId]">) {
  const { groupId } = await params;
  await requireViewer("/compte/commandes");

  if (!/^[0-9a-f-]{36}$/i.test(groupId)) {
    notFound();
  }

  const [group, t] = await Promise.all([getOrderGroup(groupId), getTranslations("checkout")]);

  if (!group) {
    notFound();
  }

  return (
    <MessagePage
      title={t("confirmedTitle")}
      body={t("confirmedBody", { reference: group.reference })}
    >
      <Button asChild>
        <Link href="/compte/commandes">{t("viewOrders")}</Link>
      </Button>
    </MessagePage>
  );
}
