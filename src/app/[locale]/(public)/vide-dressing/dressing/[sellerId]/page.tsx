import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { DressingCloset } from "@/features/dressing/components/dressing-closet";
import { DressingFavorites } from "@/features/dressing/components/favorites";
import { getDressing } from "@/features/dressing/queries";
import { dressingFirstName, dressingMonogram, dressingTone } from "@/features/dressing/tone";
import { Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";
import { formatPrice } from "@/lib/utils/price";

export const revalidate = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/[locale]/vide-dressing/dressing/[sellerId]">) {
  const { sellerId } = await params;
  const [dressing, t] = await Promise.all([UUID.test(sellerId) ? getDressing(sellerId) : null, getTranslations("dressing")]);
  return { title: dressing ? t("dressingOf", { name: dressingFirstName(dressing.sellerName) }) : t("backToAll") };
}

// Le dressing d'une personne : sa teinte, son monogramme, quatre chiffres vrais, puis son portant,
// où l'on compose un lot à lui proposer.
export default async function DressingPage({ params }: PageProps<"/[locale]/vide-dressing/dressing/[sellerId]">) {
  const { locale, sellerId } = await params;
  setRequestLocale(locale);
  if (!UUID.test(sellerId)) notFound();

  const [dressing, t] = await Promise.all([getDressing(sellerId), getTranslations("dressing")]);
  if (!dressing) notFound();

  const tone = dressingTone(dressing.sellerId);
  const name = dressingFirstName(dressing.sellerName);
  const place = dressing.place ? localizedName(dressing.place, locale) : null;
  const likes = dressing.items.reduce((sum, item) => sum + item.favoriteCount, 0);
  const cheapest = Math.min(...dressing.items.map((item) => item.priceMillimes));

  const stats = [
    { key: "pieces", value: String(dressing.items.length), label: t("statPieces", { count: dressing.items.length }) },
    { key: "brands", value: String(dressing.brands.length), label: t("statBrands", { count: dressing.brands.length }) },
    { key: "likes", value: String(likes), label: t("statLikes", { count: likes }) },
    { key: "from", value: formatPrice(cheapest, locale), label: t("statFrom") },
  ];

  return (
    <DressingFavorites next={`/vide-dressing/dressing/${dressing.sellerId}`}>
      <div className="vd-page">
        <nav className="vd-crumbs" aria-label={t("backToAll")}>
          <Link href="/vide-dressing">{t("crumb")}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" dir="auto">{t("dressingOf", { name })}</span>
        </nav>

        <header className="vd-closet" style={{ "--tone": tone.surface, "--tone-ink": tone.ink } as CSSProperties}>
          <span className="vd-closet__rod" aria-hidden="true" />
          <span className="vd-avatar vd-avatar--xl vd-reveal" style={{ "--d": 0 } as CSSProperties} aria-hidden="true">
            {dressingMonogram(dressing.sellerName)}
          </span>
          <div className="vd-closet__text">
            <p className="vd-hero__kicker vd-reveal" style={{ "--d": 1 } as CSSProperties}>
              <span className="vd-live-dot" aria-hidden="true" />
              {[t("openKicker"), place].filter(Boolean).join(" · ")}
            </p>
            <h1 className="vd-closet__title vd-reveal" style={{ "--d": 2 } as CSSProperties} dir="auto">
              {t.rich("titleRich", { name, em: (chunks) => <em>{chunks}</em> })}
            </h1>
            {dressing.brands.length ? (
              <ul className="vd-closet__brands vd-reveal" style={{ "--d": 3 } as CSSProperties} aria-label={t("dressingBrands")}>
                {dressing.brands.map((brand) => (
                  <li key={brand}>
                    <Link href={{ pathname: "/vide-dressing", query: { marque: brand } }} className="vd-closet__brand" dir="auto">
                      {brand}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="vd-closet__actions vd-reveal" style={{ "--d": 3 } as CSSProperties}>
            <a href="#vd-rack-title" className="vd-hero__cta">{t("perkLot")}</a>
            <Link href={`/annonce/${dressing.items[0].id}#contact`} className="vd-hero__ghost">
              {t("write", { name })}
            </Link>
          </div>
        </header>

        <dl className="vd-stats">
          {stats.map((stat, index) => (
            <div key={stat.key} className="vd-stat" style={{ "--i": index } as CSSProperties}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>

        <DressingCloset sellerId={dressing.sellerId} name={name} items={dressing.items} />
      </div>
    </DressingFavorites>
  );
}
