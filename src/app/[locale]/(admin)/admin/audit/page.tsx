import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/features/admin/components/pagination";
import { ADMIN_PAGE_SIZE, listAuditLogs } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/permissions/viewer";
import { formatDateTime } from "@/lib/utils/format";

export default async function AdminAuditPage({ searchParams }: PageProps<"/[locale]/admin/audit">) {
  await requireAdmin("/admin/audit");
  const { page, action, element } = await searchParams;

  const currentPage = Math.max(Number(page) || 1, 1);
  const actionFilter = typeof action === "string" ? action.trim().slice(0, 40) : "";
  const entityFilter = typeof element === "string" ? element.trim().slice(0, 60) : "";

  const [{ logs, total }, t, locale] = await Promise.all([
    listAuditLogs(currentPage, actionFilter, entityFilter),
    getTranslations("admin"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("auditTitle")}</h1>

      <form className="mt-4 flex flex-wrap items-end gap-2" role="search">
        <Input
          name="action"
          dir="ltr"
          className="max-w-56"
          defaultValue={actionFilter}
          aria-label={t("colAction")}
          placeholder={t("colAction")}
        />
        <Input
          name="element"
          dir="ltr"
          className="max-w-72"
          defaultValue={entityFilter}
          aria-label={t("colEntity")}
          placeholder={t("colEntity")}
        />
        <Button type="submit" variant="outline">{t("searchSubmit")}</Button>
      </form>

      {logs.length ? (
        <ul className="mt-5 divide-y border-y">
          {logs.map((log) => (
            <li key={log.id} className="grid grid-cols-[minmax(0,1fr)] gap-0.5 py-2.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold" dir="ltr">{log.action}</span>
                <span className="text-muted-foreground tabular-nums">{formatDateTime(log.created_at, locale)}</span>
              </div>
              <p className="text-muted-foreground">
                {t("auditBy", { name: log.actorName ?? log.actor_id?.slice(0, 8) ?? t("auditSystem") })}
              </p>
              {log.entity_id ? (
                <p className="font-mono text-xs [overflow-wrap:anywhere]" dir="ltr">
                  {log.entity_type} {log.entity_id}
                </p>
              ) : null}
              {log.metadata && Object.keys(log.metadata).length ? (
                <p className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]" dir="ltr">
                  {JSON.stringify(log.metadata)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-muted-foreground">{t("auditEmpty")}</p>
      )}

      <Pagination
        page={currentPage}
        total={total}
        pageSize={ADMIN_PAGE_SIZE}
        basePath="/admin/audit"
        params={{
          ...(actionFilter ? { action: actionFilter } : {}),
          ...(entityFilter ? { element: entityFilter } : {}),
        }}
      />
    </>
  );
}
