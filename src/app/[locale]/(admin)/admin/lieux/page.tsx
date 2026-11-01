import { getTranslations } from "next-intl/server";
import { CityRow, GovernorateActions } from "@/features/admin/components/location-rows";
import { listAdminLocations } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/permissions/viewer";

export default async function AdminLocationsPage() {
  await requireAdmin("/admin/lieux");

  const [governorates, t] = await Promise.all([listAdminLocations(), getTranslations("adminReference")]);

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("locationsTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("locationsHint")}</p>

      <ul className="mt-4 divide-y border-y">
        {governorates.map((governorate) => (
          <li key={governorate.id}>
            <details className="py-2">
              <summary className="cursor-pointer py-1 font-semibold">
                {governorate.name_fr} · <span dir="rtl">{governorate.name_ar}</span>{" "}
                <span className="font-normal text-muted-foreground">({governorate.cities.length})</span>
              </summary>
              <div className="mt-2">
                <GovernorateActions id={governorate.id} nameFr={governorate.name_fr} nameAr={governorate.name_ar} />
                <ul className="mt-2 divide-y">
                  {governorate.cities.map((city) => (
                    <CityRow key={city.id} city={city} governorateId={governorate.id} />
                  ))}
                </ul>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
