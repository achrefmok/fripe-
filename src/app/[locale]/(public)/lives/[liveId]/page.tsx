import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LiveRoom } from "@/features/live/components/live-room";
import { getLive, listLiveComments } from "@/features/live/queries";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/permissions/viewer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/[locale]/lives/[liveId]">) {
  const { liveId } = await params;
  const live = UUID.test(liveId) ? await getLive(liveId) : null;
  return { title: live?.title ?? undefined, description: live?.description || undefined };
}

export default async function LivePage({ params }: PageProps<"/[locale]/lives/[liveId]">) {
  const { liveId } = await params;
  if (!UUID.test(liveId)) notFound();

  const [live, viewer, t] = await Promise.all([getLive(liveId), getViewer(), getTranslations("live")]);
  if (!live) notFound();

  const comments = await listLiveComments(live.id);

  return (
    <div className="live-page">
      <Link href="/lives" className="live-page__back">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("back")}
      </Link>
      <LiveRoom initialLive={live} initialComments={comments} signedIn={Boolean(viewer)} />
    </div>
  );
}
