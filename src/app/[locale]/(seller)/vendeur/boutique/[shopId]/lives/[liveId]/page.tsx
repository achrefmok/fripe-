import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LiveStudio } from "@/features/live/components/live-studio";
import { getLive, getLiveSales, listLiveCandidates, listLiveComments } from "@/features/live/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le studio d'un Live : préparation, direct, puis bilan.
export default async function LiveStudioPage({ params }: PageProps<"/[locale]/vendeur/boutique/[shopId]/lives/[liveId]">) {
  const { shopId, liveId } = await params;
  await requireShopAccess(shopId);
  if (!UUID.test(liveId)) notFound();

  const [live, t] = await Promise.all([getLive(liveId), getTranslations("live")]);
  if (!live || live.shopId !== shopId) notFound();

  const [comments, candidates, sales] = await Promise.all([
    listLiveComments(live.id),
    listLiveCandidates(shopId),
    getLiveSales(live).catch(() => ({ pieces: 0, revenueMillimes: 0 })),
  ]);

  return (
    <>
      <Link href={`/vendeur/boutique/${shopId}/lives`} className="vd-back">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("studioBack")}
      </Link>
      <LiveStudio initialLive={live} initialComments={comments} candidates={candidates} sales={sales} />
    </>
  );
}
