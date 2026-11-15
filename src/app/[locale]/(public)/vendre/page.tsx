import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("sellTitle") };
}

// Un seul compte, trois façons de vendre : trois étiquettes pendues à une tringle, chacune à sa
// longueur de fil. Au survol, l'étiquette tourne sur son fil.
export default async function SellPage() {
  const t = await getTranslations("market");

  const paths = [
    { href: "/vendeur", name: t("sellShopTitle"), body: t("sellShopBody"), cta: t("sellShopCta"), tone: "lx-sell--ink", drop: 30 },
    { href: "/compte/annonces/nouvelle?rubrique=vide_dressing", name: t("sellDressingTitle"), body: t("sellDressingBody"), cta: t("sellCta"), tone: "lx-sell--terra", drop: 56 },
    { href: "/compte/annonces/nouvelle?rubrique=marketplace", name: t("sellMarketTitle"), body: t("sellMarketBody"), cta: t("sellCta"), tone: "lx-sell--gold", drop: 40 },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-[18px] pb-24 pt-[26px] md:pb-14">
      <p className="luxe-kicker">{t("sellKicker")}</p>
      <h1 className="mt-1 mb-7 font-display text-[clamp(34px,5vw,58px)] font-normal leading-none">
        {t.rich("sellTitleRich", { em: (chunks) => <em>{chunks}</em> })}
      </h1>
      <p className="-mt-4 mb-7 max-w-xl leading-relaxed text-muted-foreground">{t("sellLead")}</p>
      <div className="lx-sell-rod" aria-hidden="true" />
      <ul className="lx-sell-list">
        {paths.map((path) => (
          <li key={path.href}>
            <Link href={path.href} className={`lx-sell ${path.tone}`} style={{ "--drop": `${path.drop}px` } as CSSProperties}>
              <span className="lx-sell__thread" aria-hidden="true" />
              <span className="lx-sell__tag">
                <span className="lx-sell__eyelet" aria-hidden="true" />
                <span className="lx-sell__name">{path.name}</span>
                <span className="lx-sell__body">{path.body}</span>
                <span className="lx-sell__cta">{path.cta} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
