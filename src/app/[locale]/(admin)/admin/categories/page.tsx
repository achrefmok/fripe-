import { getTranslations } from "next-intl/server";
import { CategoryRow, NewCategoryButton } from "@/features/admin/components/category-row";
import { listAdminCategories } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/permissions/viewer";

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");

  const [categories, t] = await Promise.all([listAdminCategories(), getTranslations("adminReference")]);
  const parents = categories.filter((category) => !category.parent_id);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">{t("categoriesTitle")}</h1>
        <NewCategoryButton />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("categoriesHint")}</p>

      <ul className="mt-4 divide-y border-y">
        {parents.map((parent) => (
          <li key={parent.id} className="py-1">
            <CategoryRow category={parent} />
            {categories
              .filter((category) => category.parent_id === parent.id)
              .map((child) => (
                <CategoryRow key={child.id} category={child} childLevel />
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}
