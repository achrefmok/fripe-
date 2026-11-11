"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CONDITIONS } from "@/features/catalog/constants";
import type { CategoryAttribute } from "../queries";
import type { ListingSection, MarketFilters } from "../schemas";

type Named = { value: string; nameFr: string; nameAr: string };

// La recherche reste toujours visible ; les filtres s'ouvrent dans un panneau qui monte du bas,
// à portée de pouce. Le formulaire est un simple GET : il marche sans JavaScript et se partage par lien.
export function MarketFiltersBar({
  section,
  basePath,
  filters,
  subcategories,
  attributes,
  governorates,
}: {
  section: ListingSection;
  basePath: string;
  filters: MarketFilters;
  subcategories: Named[];
  attributes: CategoryAttribute[];
  governorates: Named[];
}) {
  const t = useTranslations("market");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const label = (option: { nameFr: string; nameAr: string }) => (locale === "ar" ? option.nameAr : option.nameFr);

  const activeCount =
    [filters.etat, filters.gouvernorat, filters.prixMin, filters.prixMax, filters.vendeur].filter(Boolean).length +
    Object.keys(filters.attributes).length +
    (filters.tri !== "recent" ? 1 : 0);

  return (
    <div className="flex items-stretch gap-2">
      <form action={basePath} method="get" role="search" className="flex min-w-0 flex-1 items-stretch gap-2">
        {filters.categorie ? <input type="hidden" name="categorie" value={filters.categorie} /> : null}
        {filters.marque ? <input type="hidden" name="marque" value={filters.marque} /> : null}
        {filters.taille ? <input type="hidden" name="taille" value={filters.taille} /> : null}
        <Label htmlFor="q" className="sr-only">
          {t("searchLabel")}
        </Label>
        <Input
          id="q"
          name="q"
          type="search"
          enterKeyHint="search"
          defaultValue={filters.q}
          placeholder={t(section === "marketplace" ? "searchPlaceholderMarketplace" : "searchPlaceholderDressing")}
          className="h-11 min-w-0 flex-1"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0" aria-label={t("search")}>
          <Search />
        </Button>
      </form>

      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0 gap-2"
        aria-haspopup="dialog"
        aria-label={activeCount ? `${t("filters")} · ${t("activeFilters", { count: activeCount })}` : t("filters")}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal />
        <span className="hidden sm:inline">{t("filters")}</span>
        {activeCount ? (
          <span className="market-count" aria-hidden="true">
            {activeCount}
          </span>
        ) : null}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="market-sheet">
          <SheetHeader className="px-4 pt-4 pb-2 md:px-6">
            <SheetTitle className="font-display text-2xl font-extrabold">{t("filtersTitle")}</SheetTitle>
            <SheetDescription className="sr-only">{t("filtersTitle")}</SheetDescription>
          </SheetHeader>

          <form action={basePath} method="get" className="flex min-h-0 flex-1 flex-col">
            <input type="hidden" name="q" value={filters.q} />
            {filters.marque ? <input type="hidden" name="marque" value={filters.marque} /> : null}
            {filters.taille ? <input type="hidden" name="taille" value={filters.taille} /> : null}
            <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-x-4 gap-y-4 overflow-y-auto px-4 pb-4 md:grid-cols-3 md:px-6">
              {subcategories.length ? (
                <div className="col-span-2 md:col-span-3">
                  <Label htmlFor="f-categorie" className="text-[0.8rem] font-semibold">{t("category")}</Label>
                  <NativeSelect id="f-categorie" name="categorie" defaultValue={filters.categorie}>
                    {subcategories.map((category) => (
                      <option key={category.value} value={category.value}>{label(category)}</option>
                    ))}
                  </NativeSelect>
                </div>
              ) : filters.categorie ? (
                <input type="hidden" name="categorie" value={filters.categorie} />
              ) : null}

              {attributes.map((attribute) => (
                <div key={attribute.key}>
                  <Label htmlFor={`f-a-${attribute.key}`} className="text-[0.8rem] font-semibold">
                    {locale === "ar" ? attribute.labelAr : attribute.labelFr}
                  </Label>
                  {attribute.kind === "choice" ? (
                    <NativeSelect id={`f-a-${attribute.key}`} name={`a_${attribute.key}`} defaultValue={filters.attributes[attribute.key] ?? ""}>
                      <option value="">{t("all")}</option>
                      {attribute.options.map((option) => (
                        <option key={option.value} value={option.value}>{locale === "ar" ? option.ar : option.fr}</option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <Input id={`f-a-${attribute.key}`} name={`a_${attribute.key}`} maxLength={60} defaultValue={filters.attributes[attribute.key] ?? ""} />
                  )}
                </div>
              ))}

              <div>
                <Label htmlFor="f-etat" className="text-[0.8rem] font-semibold">{t("condition")}</Label>
                <NativeSelect id="f-etat" name="etat" defaultValue={filters.etat ?? ""}>
                  <option value="">{t("all")}</option>
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>{conditions(condition)}</option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label htmlFor="f-gouvernorat" className="text-[0.8rem] font-semibold">{t("governorate")}</Label>
                <NativeSelect id="f-gouvernorat" name="gouvernorat" defaultValue={filters.gouvernorat}>
                  <option value="">{t("all")}</option>
                  {governorates.map((governorate) => (
                    <option key={governorate.value} value={governorate.value}>{label(governorate)}</option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label htmlFor="f-prixMin" className="text-[0.8rem] font-semibold">{t("priceMin")}</Label>
                <Input id="f-prixMin" name="prixMin" inputMode="decimal" defaultValue={filters.prixMin} />
              </div>
              <div>
                <Label htmlFor="f-prixMax" className="text-[0.8rem] font-semibold">{t("priceMax")}</Label>
                <Input id="f-prixMax" name="prixMax" inputMode="decimal" defaultValue={filters.prixMax} />
              </div>

              {section === "marketplace" ? (
                <fieldset className="col-span-2 md:col-span-1">
                  <legend className="text-[0.8rem] font-semibold">{t("seller")}</legend>
                  <div className="mt-1 flex gap-2">
                    {[
                      ["", t("sellerAll")],
                      ["particulier", t("sellerParticulier")],
                      ["pro", t("sellerPro")],
                    ].map(([value, text]) => (
                      <label key={value} className="market-chip">
                        <input type="radio" name="vendeur" value={value} defaultChecked={(filters.vendeur ?? "") === value} className="sr-only" />
                        {text}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <div className={section === "marketplace" ? "col-span-2 md:col-span-2" : "col-span-2 md:col-span-1"}>
                <Label htmlFor="f-tri" className="text-[0.8rem] font-semibold">{t("sort")}</Label>
                <NativeSelect id="f-tri" name="tri" defaultValue={filters.tri}>
                  <option value="recent">{t("sortRecent")}</option>
                  <option value="price_asc">{t("sortPriceAsc")}</option>
                  <option value="price_desc">{t("sortPriceDesc")}</option>
                </NativeSelect>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6">
              <a href={filters.categorie ? `${basePath}?categorie=${encodeURIComponent(filters.categorie)}` : basePath} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold underline underline-offset-4">
                {t("reset")}
              </a>
              <Button type="submit" className="ms-auto h-11 px-6">{t("apply")}</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
