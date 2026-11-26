import { getLocale, getTranslations } from "next-intl/server";
import { Pagination } from "@/features/admin/components/pagination";
import { getModerationProvider } from "@/features/media-moderation/providers";
import {
  listMediaEvents,
  MEDIA_DECISIONS,
  MEDIA_EVENTS_PAGE_SIZE,
  type MediaDecisionFilter,
} from "@/features/media-moderation/queries";
import type { AiSignal } from "@/features/media-moderation/policy";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";

export async function generateMetadata() {
  const t = await getTranslations("mediaModeration");
  return { title: t("title") };
}

function providerName() {
  try {
    return getModerationProvider()?.name ?? null;
  } catch {
    return null;
  }
}

// Le rapport détaillé de chaque média bloqué ou signalé : compte, type de contenu, date, motif,
// sanction appliquée et indices d'IA. Les mêmes rapports arrivent en notification aux administrateurs.
export default async function AdminMediaPage({ searchParams }: PageProps<"/[locale]/admin/medias">) {
  await requireAdmin("/admin/medias");
  const { page, decision, compte } = await searchParams;

  const currentPage = Math.max(Number(page) || 1, 1);
  const decisionFilter = MEDIA_DECISIONS.includes(decision as MediaDecisionFilter) ? (decision as MediaDecisionFilter) : null;
  const accountFilter = typeof compte === "string" && /^[0-9a-f-]{36}$/i.test(compte) ? compte : null;

  const [{ events, total }, t, locale] = await Promise.all([
    listMediaEvents(currentPage, decisionFilter, accountFilter),
    getTranslations("mediaModeration"),
    getLocale(),
  ]);
  const provider = providerName();

  const filters = [
    { value: null, label: t("filterAll") },
    { value: "block" as const, label: t("filterBlock") },
    { value: "flag" as const, label: t("filterFlag") },
  ];

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("lead")}</p>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("aiCaveat")}</p>

      <p
        role="status"
        className={cn(
          "mt-4 max-w-2xl px-3 py-2 text-sm font-medium",
          provider ? "bg-muted" : "bg-destructive/10 text-destructive",
        )}
      >
        {provider ? t("providerOn", { provider }) : t("providerOff")}
      </p>

      <nav aria-label={t("filterLabel")} className="mt-5 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.label}
            href={{ pathname: "/admin/medias", query: { ...(filter.value ? { decision: filter.value } : {}), ...(accountFilter ? { compte: accountFilter } : {}) } }}
            aria-current={decisionFilter === filter.value ? "page" : undefined}
            className="inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {events.length ? (
        <ul className="mt-5 divide-y border-y">
          {events.map((event) => {
            const signals = (Array.isArray(event.ai_signals) ? event.ai_signals : []) as AiSignal[];
            return (
              <li key={event.id} className="grid gap-2 py-4 text-sm" data-testid="media-event">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        event.decision === "block" ? "bg-destructive text-white" : "bg-muted",
                      )}
                    >
                      {t(`decisions.${event.decision as "block" | "flag"}`)}
                    </span>
                    <span className="font-semibold">{t(`categories.${event.category as "sexual_explicit"}`)}</span>
                    <span className="text-muted-foreground">· {t(`severities.${event.severity as "low"}`)}</span>
                  </p>
                  <time dateTime={event.created_at} className="text-muted-foreground tabular-nums">
                    {formatDateTime(event.created_at, locale)}
                  </time>
                </div>

                <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[max-content_minmax(0,1fr)]">
                  <dt className="text-muted-foreground">{t("accountId")}</dt>
                  <dd className="min-w-0">
                    <span className="font-mono text-xs [overflow-wrap:anywhere]" dir="ltr">{event.user_id}</span>
                    {" · "}
                    <span dir="auto">{event.accountName ?? t("unknownAccount")}</span>
                    {event.accountName ? (
                      <>
                        {" · "}
                        <Link href={{ pathname: "/admin/utilisateurs", query: { q: event.accountName } }} className="font-semibold underline underline-offset-4">
                          {t("seeAccount")}
                        </Link>
                      </>
                    ) : null}
                    {accountFilter ? null : (
                      <>
                        {" · "}
                        <Link href={{ pathname: "/admin/medias", query: { compte: event.user_id } }} className="underline underline-offset-4">
                          {t("onlyAccount")}
                        </Link>
                      </>
                    )}
                  </dd>

                  <dt className="text-muted-foreground">{t("contentType")}</dt>
                  <dd>
                    {t(`kinds.${event.media_kind as "image"}`)} · {t(`contexts.${event.context as "product_image"}`)}
                  </dd>

                  <dt className="text-muted-foreground">{t("date")}</dt>
                  <dd className="tabular-nums">{formatDateTime(event.created_at, locale)}</dd>

                  <dt className="text-muted-foreground">{t("reason")}</dt>
                  <dd>{event.reason}</dd>

                  <dt className="text-muted-foreground">{t("sanction")}</dt>
                  <dd className={cn(event.sanction === "suspended" && "font-semibold text-destructive")}>
                    {t(`sanctions.${event.sanction as "none"}`)}
                    {event.attempts_30d ? ` · ${t("attempts", { count: event.attempts_30d })}` : ""}
                  </dd>

                  {signals.length ? (
                    <>
                      <dt className="text-muted-foreground">{t("aiSignals")}</dt>
                      <dd>
                        {signals
                          .map((signal) => (signal.source === "provenance" ? signal.detail : t("detectorScore", { score: signal.score })))
                          .join(" · ")}
                      </dd>
                    </>
                  ) : null}

                  <dt className="text-muted-foreground">{t("provider")}</dt>
                  <dd dir="ltr" className="text-start">{event.provider}</dd>

                  {event.sha256 ? (
                    <>
                      <dt className="text-muted-foreground">{t("fingerprint")}</dt>
                      <dd className="font-mono text-xs [overflow-wrap:anywhere]" dir="ltr">{event.sha256}</dd>
                    </>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-8 text-muted-foreground">{t("empty")}</p>
      )}

      <Pagination
        page={currentPage}
        total={total}
        pageSize={MEDIA_EVENTS_PAGE_SIZE}
        basePath="/admin/medias"
        params={{
          ...(decisionFilter ? { decision: decisionFilter } : {}),
          ...(accountFilter ? { compte: accountFilter } : {}),
        }}
      />
    </>
  );
}
