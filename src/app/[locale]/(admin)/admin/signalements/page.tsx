import { getLocale, getTranslations } from "next-intl/server";
import { ReportActions } from "@/features/moderation/components/report-actions";
import { listDecisions, listReports } from "@/features/moderation/queries";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions/viewer";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils/format";

const STATUSES = ["open", "resolved", "dismissed"] as const;

type Snapshot = {
  title?: string;
  shop?: string;
  client?: string;
  rating?: number;
  comment?: string;
  messages?: { side: string; body: string }[];
};

export default async function AdminReportsPage({
  searchParams,
}: PageProps<"/[locale]/admin/signalements">) {
  await requireAdmin("/admin/signalements");
  const { statut } = await searchParams;
  const status = STATUSES.find((value) => value === statut) ?? "open";

  const [reports, decisions, t, locale] = await Promise.all([
    listReports(status),
    listDecisions(),
    getTranslations("moderation"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("adminTitle")}</h1>

      <nav aria-label={t("adminTitle")} className="rail-scroll mt-4 flex gap-1 overflow-x-auto">
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`/admin/signalements?statut=${value}`}
            aria-current={value === status ? "true" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center px-3 text-sm font-medium",
              value === status ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`status.${value}`)}
          </Link>
        ))}
      </nav>

      {reports.length ? (
        <ul className="mt-4 divide-y border-y">
          {reports.map((report) => {
            const snapshot = report.snapshot as Snapshot;

            return (
              <li key={report.id} className="grid grid-cols-[minmax(0,1fr)] gap-2 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {t(`targets.${report.target_type}`)} · {t(`reasons.${report.reason}`)}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(report.created_at, locale)}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {[snapshot.title, snapshot.shop, snapshot.client].filter(Boolean).join(" · ")}
                </p>
                {snapshot.rating ? (
                  <p className="text-sm">{snapshot.rating}/5{snapshot.comment ? ` · ${snapshot.comment}` : ""}</p>
                ) : null}
                {report.details ? <p className="text-sm">{report.details}</p> : null}
                {snapshot.messages?.length ? (
                  <ul className="grid gap-1 bg-secondary px-3 py-2 text-sm">
                    {snapshot.messages.map((message, index) => (
                      <li key={index} className="[overflow-wrap:anywhere]">
                        <span className="font-semibold">{t(`sides.${message.side}`)} : </span>
                        {message.body}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {report.status === "open" ? <ReportActions reportId={report.id} targetType={report.target_type} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-6 text-muted-foreground">{t("adminEmpty")}</p>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">{t("history")}</h2>
        {decisions.length ? (
          <ul className="mt-3 divide-y border-y text-sm">
            {decisions.map((decision) => (
              <li key={decision.id} className="py-2">
                <p className="font-medium">
                  {t(`decisions.${decision.decision}`)}
                  {decision.reports ? ` · ${t(`targets.${decision.reports.target_type}`)}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {decision.note} · {formatDateTime(decision.created_at, locale)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("historyEmpty")}</p>
        )}
      </section>
    </>
  );
}
