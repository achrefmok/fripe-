"use client";

import { SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CONDITIONS } from "@/features/catalog/constants";
import type { CatalogFilters } from "@/features/catalog/schemas";
import { Link } from "@/i18n/navigation";

type Option = { value: string; nameFr: string; nameAr: string };

export function CatalogFiltersForm({
  filters,
  categories,
  governorates,
}: {
  filters: CatalogFilters;
  categories: Option[];
  governorates: Option[];
}) {
  const t = useTranslations("catalog");
  const conditions = useTranslations("conditions");
  const locale = useLocale();
  const hasFilters = Boolean(
    filters.categorie ||
      filters.taille ||
      filters.marque ||
      filters.etat ||
      filters.gouvernorat ||
      filters.prixMin ||
      filters.prixMax,
  );
  const [open, setOpen] = useState(hasFilters);

  const label = (option: Option) => (locale === "ar" ? option.nameAr : option.nameFr);

  return (
    <form action="" method="get">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="q" className="sr-only">
            {t("searchLabel")}
          </Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <Button type="submit">{t("search")}</Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("filters")}
          aria-expanded={open}
          aria-controls="catalog-filters"
          onClick={() => setOpen(!open)}
        >
          <SlidersHorizontal />
        </Button>
      </div>

      <div
        id="catalog-filters"
        hidden={!open}
        className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4"
      >
        <div>
          <Label htmlFor="categorie" className="text-[0.8rem] font-semibold">{t("category")}</Label>
          <NativeSelect id="categorie" name="categorie" defaultValue={filters.categorie}>
            <option value="">{t("all")}</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>{label(category)}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="taille" className="text-[0.8rem] font-semibold">{t("size")}</Label>
          <Input id="taille" name="taille" defaultValue={filters.taille} maxLength={20} />
        </div>
        <div>
          <Label htmlFor="marque" className="text-[0.8rem] font-semibold">{t("brand")}</Label>
          <Input id="marque" name="marque" defaultValue={filters.marque} maxLength={60} />
        </div>
        <div>
          <Label htmlFor="etat" className="text-[0.8rem] font-semibold">{t("condition")}</Label>
          <NativeSelect id="etat" name="etat" defaultValue={filters.etat ?? ""}>
            <option value="">{t("all")}</option>
            {CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>{conditions(condition)}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="gouvernorat" className="text-[0.8rem] font-semibold">{t("governorate")}</Label>
          <NativeSelect id="gouvernorat" name="gouvernorat" defaultValue={filters.gouvernorat}>
            <option value="">{t("all")}</option>
            {governorates.map((governorate) => (
              <option key={governorate.value} value={governorate.value}>{label(governorate)}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="prixMin" className="text-[0.8rem] font-semibold">{t("priceMin")}</Label>
          <Input id="prixMin" name="prixMin" inputMode="decimal" defaultValue={filters.prixMin} />
        </div>
        <div>
          <Label htmlFor="prixMax" className="text-[0.8rem] font-semibold">{t("priceMax")}</Label>
          <Input id="prixMax" name="prixMax" inputMode="decimal" defaultValue={filters.prixMax} />
        </div>
        <div>
          <Label htmlFor="tri" className="text-[0.8rem] font-semibold">{t("sort")}</Label>
          <NativeSelect id="tri" name="tri" defaultValue={filters.tri}>
            <option value="recent">{t("sortRecent")}</option>
            <option value="price_asc">{t("sortPriceAsc")}</option>
            <option value="price_desc">{t("sortPriceDesc")}</option>
          </NativeSelect>
        </div>
        <div className="col-span-2 flex items-center gap-3 pt-1 md:col-span-4">
          <Button type="submit" size="sm">{t("apply")}</Button>
          <Link href="/catalogue" className="text-sm font-medium underline underline-offset-4">
            {t("reset")}
          </Link>
        </div>
      </div>
    </form>
  );
}
