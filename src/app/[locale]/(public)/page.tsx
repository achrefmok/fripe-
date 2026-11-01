import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/layout/brand";
import { HangTag } from "@/components/layout/hang-tag";
import { Button } from "@/components/ui/button";
import { ProductGrid, ProductRail } from "@/features/catalog/components/product-card";
import { getHomeFeed } from "@/features/catalog/queries";
import { Link } from "@/i18n/navigation";
import { localizedName } from "@/lib/utils/format";

export const revalidate = 60;

function TagContent({ title, body }: { title: string; body: string }) {
  return (
    <span className="flex min-h-[15.5rem] flex-1 flex-col px-6 pb-6 pt-14 md:min-h-[17rem]">
      <span className="font-display text-[2.6rem] leading-[0.95] font-extrabold">{title}</span>
      <span className="mt-auto flex items-end justify-between gap-3 border-t border-current/25 pt-3 text-base leading-snug font-medium">
        {body}
        <ArrowRight className="size-5 shrink-0 rtl:-scale-x-100" />
      </span>
    </span>
  );
}

function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-3xl leading-tight font-extrabold md:text-4xl">{title}</h2>
        {href ? (
          <Link href={href} className="shrink-0 text-sm font-semibold underline underline-offset-4">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const EMPTY_FEED = {
  arrivals: [],
  recent: [],
  popular: [],
  categories: [],
  shops: [],
  collections: [],
} satisfies Awaited<ReturnType<typeof getHomeFeed>>;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const currentLocale = await getLocale();

  // L'accueil reste affichable si la base est momentanément injoignable.
  const feed = await getHomeFeed().catch((error) => {
    console.error("Accueil : flux indisponible", error);
    return EMPTY_FEED;
  });

  const modes = [
    { title: t("modeOneTitle"), body: t("modeOneBody") },
    { title: t("modeTwoTitle"), body: t("modeTwoBody") },
    { title: t("modeThreeTitle"), body: t("modeThreeBody") },
  ];

  return (
    <>
      <section className="overflow-hidden bg-harissa pt-5 text-harissa-ink md:pt-8">
        <div className="mx-auto max-w-7xl px-4 pb-7 md:px-6 md:pb-9 lg:flex lg:items-end lg:justify-between lg:gap-10">
          <h1 aria-label="FRIPE" className="-ms-[0.04em] leading-[0.8]">
            <Wordmark className="block text-[33.5vw] lg:text-[25vw] xl:text-[22rem]" />
          </h1>
          <p className="mt-5 max-w-xl text-xl leading-snug font-medium md:mt-7 md:text-2xl lg:mt-0 lg:max-w-72 lg:pb-3">
            {t("tagline")}
          </p>
        </div>

        <div className="rail text-ink dark:text-paper" aria-hidden="true" />

        <div className="rail-scroll mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 pb-10 text-ink md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:px-6 md:pb-14 dark:text-paper">
          <HangTag
            href="/catalogue"
            className="w-[76vw] max-w-72 shrink-0 snap-center md:w-auto md:max-w-none"
            bodyClassName="bg-kraft text-[oklch(0.2_0.014_55)]"
            string="3rem"
          >
            <TagContent title={t("tagSoonTitle")} body={t("tagSoonBody")} />
          </HangTag>
          <HangTag
            href="/inscription"
            className="w-[76vw] max-w-72 shrink-0 snap-center md:w-auto md:max-w-none"
            bodyClassName="bg-paper text-[oklch(0.2_0.014_55)]"
            string="5.5rem"
            delay={120}
          >
            <TagContent title={t("tagBuyTitle")} body={t("tagBuyBody")} />
          </HangTag>
          <HangTag
            href="/vendeur/creer-boutique"
            className="w-[76vw] max-w-72 shrink-0 snap-center md:w-auto md:max-w-none"
            bodyClassName="bg-[oklch(0.2_0.014_55)] text-[oklch(0.955_0.016_88)]"
            string="2.25rem"
            delay={240}
          >
            <TagContent title={t("tagSellTitle")} body={t("tagSellBody")} />
          </HangTag>
        </div>
      </section>

      {feed.arrivals.length ? (
        <Section title={t("arrivalsTitle")} href="/catalogue" linkLabel={t("seeAll")}>
          <ProductRail products={feed.arrivals} />
        </Section>
      ) : (
        <Section title={t("emptyTitle")}>
          <p className="max-w-md text-muted-foreground">{t("emptyBody")}</p>
        </Section>
      )}

      {feed.categories.length ? (
        <Section title={t("categoriesTitle")}>
          <ul className="flex flex-wrap gap-2">
            {feed.categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={{ pathname: "/catalogue", query: { categorie: category.slug } }}
                  className="status-tag !h-10 bg-secondary !px-5 !text-sm hover:bg-foreground hover:text-background"
                >
                  {currentLocale === "ar" ? category.nameAr : category.nameFr}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {feed.popular.length ? (
        <Section title={t("popularTitle")}>
          <ProductRail products={feed.popular} />
        </Section>
      ) : null}

      {feed.shops.length ? (
        <Section title={t("shopsTitle")} href="/boutiques" linkLabel={t("seeAll")}>
          <ul className="divide-y border-y md:grid md:grid-cols-2 md:gap-x-8 md:divide-y-0">
            {feed.shops.map((shop) => (
              <li key={shop.id} className="md:border-b">
                <Link href={`/boutique/${shop.slug}`} className="flex items-baseline justify-between gap-3 py-3">
                  <span className="truncate font-display text-xl font-bold">{shop.name}</span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {localizedName({ name_fr: shop.city_fr, name_ar: shop.city_ar }, currentLocale)} ·{" "}
                    {t("shopPieces", { count: shop.product_count })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {feed.collections.length ? (
        <Section title={t("collectionsTitle")}>
          <ul className="grid gap-2 md:grid-cols-3">
            {feed.collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/boutique/${collection.shops.slug}/collection/${collection.id}`}
                  className="block bg-secondary px-4 py-4 transition-colors hover:bg-foreground hover:text-background"
                >
                  <span className="block font-display text-lg font-bold">{collection.name}</span>
                  <span className="block text-sm opacity-75">{collection.shops.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {feed.recent.length ? (
        <Section title={t("recentTitle")} href="/catalogue" linkLabel={t("seeAll")}>
          <ProductGrid products={feed.recent} />
        </Section>
      ) : null}

      <Section title={t("discoverTitle")}>
        <ul className="grid gap-2 md:grid-cols-3">
          {[
            { href: "/walk", title: t("discoverWalk"), body: t("discoverWalkBody") },
            { href: "/stylist", title: t("discoverStylist"), body: t("discoverStylistBody") },
            { href: "/tenues/nouvelle", title: t("discoverOutfit"), body: t("discoverOutfitBody") },
          ].map((entry) => (
            <li key={entry.href}>
              <Link
                href={entry.href}
                className="block bg-secondary px-4 py-4 transition-colors hover:bg-foreground hover:text-background"
              >
                <span className="block font-display text-lg font-bold">{entry.title}</span>
                <span className="block text-sm opacity-75">{entry.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <section className="mt-8 bg-[oklch(0.2_0.014_55)] text-[oklch(0.955_0.016_88)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_1fr] md:gap-16 md:px-6 md:py-28">
          <div>
            <h2 className="font-display text-4xl leading-[1.02] font-extrabold md:text-6xl">
              {t("proTitle")}
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed opacity-85">{t("proBody")}</p>
          </div>
          <ul className="divide-y divide-current/20 border-y border-current/20">
            {modes.map((mode) => (
              <li key={mode.title} className="py-5 md:py-6">
                <h3 className="font-display text-2xl font-bold">{mode.title}</h3>
                <p className="mt-1 leading-relaxed opacity-85">{mode.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <h2 className="max-w-3xl font-display text-4xl leading-[1.02] font-extrabold md:text-6xl">
          {t("localTitle")}
        </h2>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {t("localBody")}
        </p>

        <div className="mt-14 border-t-[5px] border-foreground pt-8 md:mt-20 md:flex md:items-end md:justify-between md:gap-10">
          <div>
            <h2 className="font-display text-3xl leading-tight font-extrabold md:text-5xl">
              {t("closeTitle")}
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">{t("closeBody")}</p>
          </div>
          <Button asChild size="lg" className="mt-6 w-full md:mt-0 md:w-auto">
            <Link href="/vendeur/creer-boutique">
              {t("closeCta")}
              <ArrowRight className="rtl:-scale-x-100" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
