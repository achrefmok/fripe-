import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  params,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  params: Record<string, string>;
}) {
  const t = useTranslations("common");
  const pages = Math.ceil(total / pageSize);

  if (pages <= 1) return null;

  const hrefFor = (target: number) => ({
    pathname: basePath,
    query: { ...params, page: target },
  });

  return (
    <nav className="mt-5 flex items-center gap-3">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(page - 1)}>{t("previous")}</Link>
        </Button>
      ) : null}
      <span className="text-sm text-muted-foreground">
        {t("pageOf", { page, total: pages })}
      </span>
      {page < pages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={hrefFor(page + 1)}>{t("next")}</Link>
        </Button>
      ) : null}
    </nav>
  );
}
