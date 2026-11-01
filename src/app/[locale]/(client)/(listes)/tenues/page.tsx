import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { listMyOutfits } from "@/features/stylist/outfits";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";

export default async function MyOutfitsPage() {
  const viewer = await requireViewer("/tenues");
  const [outfits, t] = await Promise.all([listMyOutfits(viewer.id), getTranslations("outfits")]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
        <Button asChild size="sm">
          <Link href="/tenues/nouvelle">{t("create")}</Link>
        </Button>
      </div>
      <div className="mt-6">
        {outfits.length ? (
          <ul className="divide-y border-y">
            {outfits.map((outfit) => (
              <li key={outfit.id}>
                <Link href={`/tenues/${outfit.id}`} className="flex items-baseline justify-between gap-3 py-3">
                  <span className="truncate font-semibold">{outfit.name}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {t("pieces", { count: outfit.outfit_items.length })}
                    {outfit.is_public ? ` · ${t("publicLabel")}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title={t("emptyTitle")} body={t("emptyBody")} />
        )}
      </div>
    </>
  );
}
