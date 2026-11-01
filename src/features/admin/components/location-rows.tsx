"use client";

import { useTranslations } from "next-intl";
import { deleteCity, saveCity, saveGovernorate, setCityActive } from "@/features/admin/actions";
import { cn } from "@/lib/utils";
import { ReferenceAction, ReferenceDialog } from "./reference-dialog";

type City = { id: number; name_fr: string; name_ar: string; is_active: boolean };

export function GovernorateActions({
  id,
  nameFr,
  nameAr,
}: {
  id: number;
  nameFr: string;
  nameAr: string;
}) {
  const t = useTranslations("adminReference");

  return (
    <div className="flex flex-wrap gap-1">
      <ReferenceDialog
        trigger={t("addCity")}
        title={t("addCityTo", { name: nameFr })}
        onSave={(values) => saveCity({ id: null, governorateId: id, nameFr: values.nameFr, nameAr: values.nameAr })}
      />
      <ReferenceDialog
        trigger={t("edit")}
        title={t("editName", { name: nameFr })}
        variant="ghost"
        initial={{ nameFr, nameAr }}
        onSave={(values) => saveGovernorate({ id, nameFr: values.nameFr, nameAr: values.nameAr })}
      />
    </div>
  );
}

export function CityRow({ city, governorateId }: { city: City; governorateId: number }) {
  const t = useTranslations("adminReference");

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
      <span className={cn("min-w-0 flex-1", !city.is_active && "text-muted-foreground line-through")}>
        {city.name_fr} · <span dir="rtl">{city.name_ar}</span>
      </span>
      <div className="flex flex-wrap gap-1">
        <ReferenceDialog
          trigger={t("edit")}
          title={t("editName", { name: city.name_fr })}
          variant="ghost"
          initial={{ nameFr: city.name_fr, nameAr: city.name_ar }}
          onSave={(values) => saveCity({ id: city.id, governorateId, nameFr: values.nameFr, nameAr: values.nameAr })}
        />
        <ReferenceAction
          label={city.is_active ? t("disable") : t("enable")}
          run={() => setCityActive(city.id, !city.is_active)}
        />
        <ReferenceAction label={t("delete")} run={() => deleteCity(city.id)} />
      </div>
    </li>
  );
}
