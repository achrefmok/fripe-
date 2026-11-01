import { getTranslations } from "next-intl/server";
import { BlockShopButton } from "@/features/messaging/components/block-buttons";
import { listMyBlockedShops } from "@/features/messaging/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function MyBlocksPage() {
  const viewer = await requireViewer("/compte/blocages");
  const [blocks, t] = await Promise.all([listMyBlockedShops(viewer.id), getTranslations("messaging")]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("blocksTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("blocksHint")}</p>
      {blocks.length ? (
        <ul className="mt-4 divide-y border-y">
          {blocks.map((block) => (
            <li key={block.shop_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              {block.shops ? (
                <Link href={`/boutique/${block.shops.slug}`} className="min-w-0 font-semibold">{block.shops.name}</Link>
              ) : (
                <span className="text-muted-foreground">{t("blockedShopGone")}</span>
              )}
              <BlockShopButton shopId={block.shop_id} blocked />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("blocksEmpty")}</p>
      )}
    </>
  );
}
