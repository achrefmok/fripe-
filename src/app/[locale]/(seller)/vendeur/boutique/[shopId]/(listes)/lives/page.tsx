import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { LiveForm } from "@/features/live/components/live-form";
import { LiveBadge } from "@/features/live/components/live-parts";
import { LiveWithdrawButton } from "@/features/live/components/live-withdraw";
import { listLiveCandidates, listShopLives } from "@/features/live/queries";
import { getShop } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { requireShopAccess } from "@/lib/permissions/viewer";
import { formatDateTime } from "@/lib/utils/format";

// « Lives » : programmer un direct, retrouver ceux qui arrivent, relire le bilan de ceux qui sont passés.
export default async function ShopLivesPage({ params }: PageProps<"/[locale]/vendeur/boutique/[shopId]/lives">) {
  const { shopId } = await params;
  const { role } = await requireShopAccess(shopId);

  const [shop, lives, candidates, t, locale] = await Promise.all([
    getShop(shopId),
    listShopLives(shopId),
    listLiveCandidates(shopId),
    getTranslations("live"),
    getLocale(),
  ]);

  if (!shop) notFound();

  const canManage = role !== "staff" && shop.status === "approved";
  const base = `/vendeur/boutique/${shopId}/lives`;

  return (
    <div className="seller-dash">
      <div>
        <h2 className="font-display text-[clamp(26px,3.4vw,34px)] font-normal">{t("sellerTitle")}</h2>
        <p className="mt-1 max-w-xl text-muted-foreground">{t("sellerLead")}</p>
      </div>

      {shop.status !== "approved" ? <p className="seller-note">{t("shopNotApproved")}</p> : null}

      {canManage ? (
        <details className="studio__edit" open={!lives.length}>
          <summary>{t("newTitle")}</summary>
          <div className="pt-4">
            <LiveForm shopId={shopId} candidates={candidates} />
          </div>
        </details>
      ) : null}

      <section aria-labelledby="mes-lives">
        <h3 id="mes-lives" className="luxe-kicker">{t("myLives")}</h3>
        {lives.length ? (
          <ul className="seller-orders mt-2">
            {lives.map((live) => (
              <li key={live.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="relative h-[72px] w-[54px] shrink-0 overflow-hidden rounded-xl bg-cream">
                  {live.coverUrl ? <Image src={live.coverUrl} alt="" fill sizes="54px" className="object-cover" /> : null}
                </span>
                <span className="flex min-w-0 flex-[1_1_180px] flex-col gap-0.5">
                  <span className="truncate font-medium" dir="auto">{live.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {live.status === "live"
                      ? null
                      : live.status === "scheduled"
                        ? live.scheduledAt
                          ? t("scheduledFor", { date: formatDateTime(live.scheduledAt, locale) })
                          : t("noDate")
                        : live.status === "ended"
                          ? t("ended")
                          : t("cancelled")}
                    {live.status === "live" ? null : " · "}
                    {t("pieces", { count: live.products.length })}
                  </span>
                  {live.status === "live" ? <LiveBadge label={t("liveNow")} /> : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {canManage && live.status !== "live" ? <LiveWithdrawButton shopId={shopId} liveId={live.id} title={live.title} /> : null}
                  <Link href={`${base}/${live.id}`} className="studio__open">
                    {live.status === "ended" || live.status === "cancelled" ? t("seeReplay") : t("openStudio")}
                    <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("noLives")}</p>
        )}
      </section>
    </div>
  );
}
