import { getLocale, getTranslations } from "next-intl/server";
import { ModerateVideoButton } from "@/features/admin/components/market-actions";
import { listAdminVideos } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/permissions/viewer";
import { formatDate } from "@/lib/utils/format";

export default async function AdminVideosPage() {
  await requireAdmin("/admin/videos");

  const [videos, t, locale] = await Promise.all([listAdminVideos(), getTranslations("adminMarket"), getLocale()]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("videosTitle")}</h1>

      {videos.length ? (
        <ul className="mt-4 divide-y border-y">
          {videos.map((video) => (
            <li key={video.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{video.description ?? video.id}</p>
                <p className="text-sm text-muted-foreground">
                  {video.shops?.name} · {formatDate(video.created_at, locale)}
                </p>
              </div>
              <ModerateVideoButton videoId={video.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("videosEmpty")}</p>
      )}
    </>
  );
}
