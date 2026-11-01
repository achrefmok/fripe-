import { getTranslations } from "next-intl/server";
import { BlockClientButton } from "@/features/messaging/components/block-buttons";
import { listShopBlockedClients } from "@/features/messaging/queries";
import { requireShopAccess } from "@/lib/permissions/viewer";

export default async function ShopBlocksPage({
  params,
}: PageProps<"/[locale]/vendeur/boutique/[shopId]/blocages">) {
  const { shopId } = await params;
  await requireShopAccess(shopId);

  const [blocks, t] = await Promise.all([listShopBlockedClients(shopId), getTranslations("messaging")]);

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl font-bold">{t("blocksTitle")}</h2>
      <p className="mt-1 text-muted-foreground">{t("shopBlocksHint")}</p>
      {blocks.length ? (
        <ul className="mt-4 divide-y border-y">
          {blocks.map((block) => (
            <li key={block.client_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="min-w-0 font-semibold">{block.client_name}</span>
              <BlockClientButton shopId={shopId} clientId={block.client_id} blocked />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("blocksEmpty")}</p>
      )}
    </div>
  );
}
