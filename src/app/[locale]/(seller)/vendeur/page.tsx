import { ArrowRight, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { StatusTag } from "@/components/layout/status-tag";
import { Button } from "@/components/ui/button";
import { getMyShops } from "@/features/shops/queries";
import { Link } from "@/i18n/navigation";
import { requireViewer } from "@/lib/permissions/viewer";
import { localizedName } from "@/lib/utils/format";

export async function generateMetadata() {
  const t = await getTranslations("seller");
  return { title: t("title") };
}

export default async function SellerHomePage() {
  const viewer = await requireViewer("/vendeur");
  const shops = await getMyShops(viewer.id);
  const t = await getTranslations("seller");
  const locale = await getLocale();

  if (!shops.length) {
    return (
      <section className="max-w-lg py-10">
        <h1 className="font-display text-4xl leading-tight font-extrabold">{t("emptyTitle")}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{t("emptyBody")}</p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/vendeur/creer-boutique">
            {t("emptyCta")}
            <ArrowRight className="rtl:-scale-x-100" />
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("navShops")}</h1>
      <ul className="mt-6 divide-y border-y">
        {shops.map((shop) => (
          <li key={shop.id}>
            <Link
              href={`/vendeur/boutique/${shop.id}`}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-lg font-semibold">{shop.name}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {shop.cities && localizedName(shop.cities, locale)}
                </span>
              </span>
              <StatusTag status={shop.status} />
              <span className="text-sm font-semibold underline-offset-4 hover:underline">
                {t("manage")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
