"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties, KeyboardEvent } from "react";
import { ProductCard } from "@/features/catalog/components/product-card";
import type { ProductCardData } from "@/features/catalog/queries";
import { universeFor } from "../universes";
import { Garment } from "./garment";
import { SHOWCASE_ID, useUniverse } from "./universe-context";
import { UniverseLink } from "./universe-link";

export type Shelf = {
  slug: string;
  name: string;
  // Les sous-catégories réelles servent de description : rien n'est inventé.
  description: string;
  products: ProductCardData[];
  total: number;
};

// La section prend la couleur de l'univers choisi : changer d'onglet, c'est changer de rayon.
export function UniverseShowcase({ shelves }: { shelves: Shelf[] }) {
  const t = useTranslations("home");
  const { selected, select } = useUniverse();
  const shelf = shelves.find((entry) => entry.slug === selected) ?? shelves[0];

  if (!shelf) return null;

  const universe = universeFor(shelf.slug);
  const style = {
    "--u-surface": universe.surface,
    "--u-ink": universe.ink,
    "--foreground": universe.ink,
    "--muted-foreground": `color-mix(in oklch, ${universe.ink} 82%, transparent)`,
    "--secondary": `color-mix(in oklch, ${universe.ink} 14%, transparent)`,
  } as CSSProperties;

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: shelves.length - 1 - index };
    let step = keys[event.key];
    if (step === undefined) return;

    event.preventDefault();
    // En arabe, la flèche droite revient en arrière.
    if (document.documentElement.dir === "rtl" && (event.key === "ArrowRight" || event.key === "ArrowLeft")) step = -step;

    const next = shelves[(index + step + shelves.length) % shelves.length];
    select(next.slug);
    document.getElementById(`univers-onglet-${next.slug}`)?.focus();
  }

  return (
    <section id={SHOWCASE_ID} className="showcase" style={style} aria-labelledby="univers-titre">
      <h2 id="univers-titre" className="sr-only">
        {t("categoriesTitle")}
      </h2>
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
        <div role="tablist" aria-label={t("categoriesTitle")} className="rail-scroll -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {shelves.map((entry, index) => (
            <button
              key={entry.slug}
              id={`univers-onglet-${entry.slug}`}
              type="button"
              role="tab"
              aria-selected={entry.slug === shelf.slug}
              aria-controls="univers-panneau"
              tabIndex={entry.slug === shelf.slug ? 0 : -1}
              className="showcase__tab"
              onClick={() => select(entry.slug)}
              onKeyDown={(event) => move(event, index)}
            >
              {entry.name}
            </button>
          ))}
        </div>

        <div
          key={shelf.slug}
          id="univers-panneau"
          role="tabpanel"
          aria-labelledby={`univers-onglet-${shelf.slug}`}
          className="showcase__panel"
        >
          <div className="mt-8 flex items-end justify-between gap-6 md:mt-12">
            <div className="min-w-0">
              <h3 className="showcase__name">{shelf.name}</h3>
              {shelf.description ? <p className="mt-3 max-w-md text-base leading-relaxed md:text-lg">{shelf.description}</p> : null}
              <UniverseLink
                href={{ pathname: "/catalogue", query: { categorie: shelf.slug } }}
                name={shelf.name}
                surface={universe.surface}
                ink={universe.ink}
                className="showcase__more"
              >
                {t("seeAll")}
                {shelf.total ? <span className="opacity-80">· {t("shopPieces", { count: shelf.total })}</span> : null}
                <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
              </UniverseLink>
            </div>
            <Garment universe={universe} className="showcase__garment" />
          </div>

          {shelf.products.length ? (
            <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 md:mt-10 md:grid-cols-4 md:gap-x-5">
              {shelf.products.map((product, index) => (
                <div key={product.id} className="showcase__card" style={{ "--i": index } as CSSProperties}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-8 max-w-md text-lg">{t("universeEmpty")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
