import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { DressingCloset } from "@/features/dressing/components/dressing-closet";
import { DressingFavorites } from "@/features/dressing/components/favorites";
import { DressingWardrobe, type Rayon } from "@/features/dressing/components/dressing-wardrobe";
import { getDressing, getDressingOverview } from "@/features/dressing/queries";
import { getCategories } from "@/features/catalog/queries";
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

  const [dressing, t, categories, overview] = await Promise.all([
    getDressing(sellerId),
    getTranslations("dressing"),
    getCategories("mode").catch(() => []),
    getDressingOverview().catch(() => ({ dressings: [] })),
  ]);
  if (!dressing) notFound();

  // Chaque pièce dans son rayon de l'armoire, d'après la racine de sa catégorie.
  const RAYON_OF: Record<string, Rayon> = { chaussures: "chaussures", sneakers: "chaussures", accessoires: "accessoires", hauts: "vetements", bas: "vetements", "vestes-manteaux": "vetements", robes: "vetements" };
  const rootSlug = (categoryId: string) => {
    const category = categories.find((entry) => entry.id === categoryId);
    return category?.parentId ? categories.find((entry) => entry.id === category.parentId)?.slug : category?.slug;
  };
  const rayons = Object.fromEntries(dressing.items.map((item) => [item.id, RAYON_OF[rootSlug(item.categoryId) ?? ""] ?? "autres"])) as Record<string, Rayon>;
  const otherWardrobes = overview.dressings.filter((entry) => entry.sellerId !== dressing.sellerId).slice(0, 4);

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

        <DressingWardrobe name={name} items={dressing.items} rayons={rayons} />

        <DressingCloset sellerId={dressing.sellerId} name={name} items={dressing.items} />

        {otherWardrobes.length ? (
          <nav className="mt-10" aria-labelledby="autres-armoires">
            <h2 id="autres-armoires" className="font-display text-[clamp(22px,3vw,30px)]">{t("otherWardrobes")}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {otherWardrobes.map((entry) => (
                <li key={entry.sellerId}>
                  <Link href={`/vide-dressing/dressing/${entry.sellerId}`} className="group block rounded-[18px] border border-border p-2.5 transition-colors hover:border-[var(--vd-gold)]">
                    <span className="grid grid-cols-3 gap-1">
                      {entry.previews.slice(0, 3).map((url, index) => (
                        <span key={`${index}-${url}`} className="relative aspect-[3/4] overflow-hidden rounded-lg bg-secondary">
                          <Image src={url} alt="" fill sizes="6rem" className="object-cover" />
                        </span>
                      ))}
                    </span>
                    <span className="mt-2 block truncate font-medium" dir="auto">{t("dressingOf", { name: dressingFirstName(entry.sellerName) })}</span>
                    <span className="block text-xs text-muted-foreground">{t("otherWardrobeCount", { count: entry.count })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </DressingFavorites>
  );
}
