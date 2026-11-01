import { Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { StatusTag } from "@/components/layout/status-tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserStatusAction } from "@/features/admin/components/admin-actions";
import { Pagination } from "@/features/admin/components/pagination";
import { ADMIN_PAGE_SIZE, listUsers } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/permissions/viewer";
import { formatDate } from "@/lib/utils/format";

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/[locale]/admin/utilisateurs">) {
  await requireAdmin("/admin/utilisateurs");
  const { q, page } = await searchParams;

  const search = typeof q === "string" ? q.slice(0, 100) : "";
  const currentPage = Math.max(Number(page) || 1, 1);

  const [{ users, total }, t, locale] = await Promise.all([
    listUsers(search, currentPage),
    getTranslations("admin"),
    getLocale(),
  ]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("usersTitle")}</h1>

      <form className="mt-5 flex max-w-md items-end gap-2" role="search">
        <div className="flex-1">
          <label htmlFor="q" className="sr-only">
            {t("searchLabel")}
          </label>
          <Input id="q" name="q" type="search" defaultValue={search} placeholder={t("searchLabel")} />
        </div>
        <Button type="submit" variant="outline" size="icon" aria-label={t("searchSubmit")}>
          <Search />
        </Button>
      </form>

      {users.length ? (
        <ul className="mt-5 divide-y border-y">
          {users.map((user) => (
            <li key={user.id} className="grid gap-2 py-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{user.display_name}</p>
                  <StatusTag status={user.status === "active" ? "active" : "accountSuspended"} />
                  {user.is_admin ? (
                    <span className="text-xs font-semibold text-harissa">{t("adminBadge")}</span>
                  ) : null}
                </div>
                <p className="truncate text-sm text-muted-foreground" dir="ltr">
                  {user.email}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("colShops")} : {user.shop_count} · {formatDate(user.created_at, locale)}
                </p>
              </div>
              {user.is_admin ? null : (
                <UserStatusAction
                  userId={user.id}
                  userName={user.display_name}
                  status={user.status}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-muted-foreground">{t("usersEmpty")}</p>
      )}

      <Pagination
        page={currentPage}
        total={total}
        pageSize={ADMIN_PAGE_SIZE}
        basePath="/admin/utilisateurs"
        params={search ? { q: search } : {}}
      />
    </>
  );
}
