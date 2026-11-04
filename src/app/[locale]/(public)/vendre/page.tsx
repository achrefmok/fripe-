import { ArrowRight, Shirt, Sofa, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("market");
  return { title: t("sellTitle") };
}

// Un seul compte, trois façons de vendre : le choix se fait ici, pas dans un menu.
export default async function SellPage() {
  const t = await getTranslations("market");

  const personal = [
    { href: "/compte/annonces/nouvelle?rubrique=marketplace", title: t("sellMarketTitle"), body: t("sellMarketBody"), icon: Sofa, tone: "sell-tile--marketplace" },
    { href: "/compte/annonces/nouvelle?rubrique=vide_dressing", title: t("sellDressingTitle"), body: t("sellDressingBody"), icon: Shirt, tone: "sell-tile--dressing" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 pb-24 md:px-6 md:pt-12 md:pb-16">
      <h1 className="font-display text-4xl leading-tight font-extrabold md:text-6xl">{t("sellTitle")}</h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-muted-foreground">{t("sellLead")}</p>

      <h2 className="mt-10 font-display text-xl font-extrabold">{t("sellAsPerson")}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {personal.map(({ href, title, body, icon: Icon, tone }) => (
          <li key={href}>
            <Link href={href} className={`sell-tile ${tone}`}>
              <Icon className="size-7" aria-hidden="true" />
              <span className="mt-auto block font-display text-3xl font-extrabold">{title}</span>
              <span className="mt-1 block leading-snug">{body}</span>
              <ArrowRight className="mt-4 size-5 rtl:-scale-x-100" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-xl font-extrabold">{t("sellAsPro")}</h2>
      <Link href="/vendeur" className="sell-tile sell-tile--pro mt-3">
        <Store className="size-7" aria-hidden="true" />
        <span className="mt-auto block font-display text-3xl font-extrabold">{t("sellShopTitle")}</span>
        <span className="mt-1 block leading-snug">{t("sellShopBody")}</span>
        <ArrowRight className="mt-4 size-5 rtl:-scale-x-100" aria-hidden="true" />
      </Link>
    </div>
  );
}
