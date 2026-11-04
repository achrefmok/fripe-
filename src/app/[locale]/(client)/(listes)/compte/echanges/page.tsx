import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { getListingThreads } from "@/features/marketplace/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { formatDateTime } from "@/lib/utils/format";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("threadsTitle") };
}

export default async function ListingThreadsPage() {
  const viewer = await requireViewer("/compte/echanges");
  const [threads, t, locale] = await Promise.all([getListingThreads(viewer.id), getTranslations("market"), getLocale()]);

  return (
    <>
      <h1 className="font-display text-4xl font-extrabold">{t("threadsTitle")}</h1>
      {threads.length ? (
        <ul className="mt-6 divide-y border-y">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link href={`/compte/echanges/${thread.id}`} className="flex items-start gap-3 py-4">
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">{thread.otherName}</span>
                    <span className="status-tag shrink-0 bg-secondary">{thread.selling ? t("selling") : t("buying")}</span>
                    {thread.unread ? <span className="status-tag shrink-0 bg-harissa text-harissa-ink">{t("unread")}</span> : null}
                    {thread.closed ? <span className="status-tag shrink-0 bg-secondary">{t("closed")}</span> : null}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{t("threadAbout", { title: thread.listingTitle })}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(thread.lastMessageAt, locale)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <EmptyState title={t("threadsEmptyTitle")} body={t("threadsEmptyBody")} />
        </div>
      )}
    </>
  );
}
