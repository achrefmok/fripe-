import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { DressingGrid } from "@/features/dressing/components/dressing-card";
import { DressingFavorites } from "@/features/dressing/components/favorites";
import { getDressing } from "@/features/dressing/queries";
import { dressingFirstName, dressingMonogram, dressingTone } from "@/features/dressing/tone";
import { Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";

export const revalidate = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/[locale]/vide-dressing/dressing/[sellerId]">) {
  const { sellerId } = await params;
  const [dressing, t] = await Promise.all([UUID.test(sellerId) ? getDressing(sellerId) : null, getTranslations("dressing")]);
  return { title: dressing ? t("dressingOf", { name: dressingFirstName(dressing.sellerName) }) : t("backToAll") };
}

// Le dressing d'une personne : sa teinte, son monogramme, les marques qu'on y trouve, et toutes
// ses pièces en vente.
export default async function DressingPage({ params }: PageProps<"/[locale]/vide-dressing/dressing/[sellerId]">) {
  const { locale, sellerId } = await params;
  setRequestLocale(locale);
  if (!UUID.test(sellerId)) notFound();

  const [dressing, t] = await Promise.all([getDressing(sellerId), getTranslations("dressing")]);
  if (!dressing) notFound();

  const tone = dressingTone(dressing.sellerId);
  const name = dressingFirstName(dressing.sellerName);

  return (
    <DressingFavorites next={`/vide-dressing/dressing/${dressing.sellerId}`}>
      <div className="vd-page">
        <Link href="/vide-dressing" className="vd-back">
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
          {t("backToAll")}
        </Link>

        <header className="vd-closet" style={{ "--tone": tone.surface, "--tone-ink": tone.ink } as CSSProperties}>
          <span className="vd-closet__rod" aria-hidden="true" />
          <span className="vd-avatar vd-avatar--lg" aria-hidden="true">{dressingMonogram(dressing.sellerName)}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="vd-hero__kicker">{t("dressingKicker")}</p>
            <h1 className="vd-closet__title" dir="auto">{t("dressingOf", { name })}</h1>
            <p className="text-sm opacity-85">
              {[dressing.place ? localizedName(dressing.place, locale) : null, t("dressingLead", { count: dressing.items.length })].filter(Boolean).join(" · ")}
            </p>
          </div>
          {dressing.brands.length ? (
            <div className="vd-closet__brands">
              <p className="vd-hero__kicker">{t("dressingBrands")}</p>
              <ul className="flex flex-wrap gap-1.5">
                {dressing.brands.map((brand) => (
                  <li key={brand}>
                    <Link href={{ pathname: "/vide-dressing", query: { marque: brand } }} className="vd-closet__brand" dir="auto">{brand}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </header>

        <section className="vd-section" aria-label={t("allTitle")}>
          <DressingGrid items={dressing.items} showSeller={false} />
        </section>
      </div>
    </DressingFavorites>
  );
}
