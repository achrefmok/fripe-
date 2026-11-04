import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ListingThread } from "@/features/marketplace/components/listing-thread";
import { getListingThread } from "@/features/marketplace/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function ListingThreadPage({ params }: PageProps<"/[locale]/compte/echanges/[threadId]">) {
  const { threadId } = await params;
  const viewer = await requireViewer(`/compte/echanges/${threadId}`);

  if (!/^[0-9a-f-]{36}$/i.test(threadId)) notFound();

  const [thread, t] = await Promise.all([getListingThread(threadId, viewer.id), getTranslations("market")]);
  if (!thread) notFound();

  return (
    <>
      <Link href="/compte/echanges" className="text-sm font-semibold underline underline-offset-4">{t("threadsTitle")}</Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold">{thread.otherName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {thread.listing_id ? (
          <Link href={`/annonce/${thread.listing_id}`} className="underline underline-offset-4">
            {t("threadAbout", { title: thread.listing_title })}
          </Link>
        ) : (
          <>{t("threadAbout", { title: thread.listing_title })} · {t("listingGone")}</>
        )}
      </p>
      <ListingThread
        threadId={thread.id}
        otherId={thread.otherId}
        otherName={thread.otherName}
        initialMessages={thread.messages}
        closed={Boolean(thread.closed_at)}
      />
    </>
  );
}
