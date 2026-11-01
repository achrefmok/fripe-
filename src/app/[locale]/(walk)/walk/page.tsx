import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { WalkFeed } from "@/features/walk/components/walk-feed";
import { getFavoriteVideoIds, getWalkPage, getWalkVideo } from "@/features/walk/queries";
import { getViewer } from "@/lib/permissions/viewer";

export async function generateMetadata() {
  const t = await getTranslations("walk");
  return { title: t("title") };
}

export default async function WalkPage({ searchParams }: PageProps<"/[locale]/walk">) {
  const { v } = await searchParams;
  const sharedId = typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null;

  const [shared, viewer, t] = await Promise.all([
    sharedId ? getWalkVideo(sharedId) : null,
    getViewer(),
    getTranslations("walk"),
  ]);

  const page = await getWalkPage(null, shared?.id);
  const items = shared ? [shared, ...page.items] : page.items;
  const favoriteIds = viewer ? await getFavoriteVideoIds(viewer.id) : [];

  if (!items.length) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10">
        <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-md">
      <WalkFeed
        initialItems={items}
        initialCursor={page.nextCursor}
        signedIn={Boolean(viewer)}
        favoriteIds={favoriteIds}
      />
    </div>
  );
}
