"use client";

import { useLocale, useTranslations } from "next-intl";
import { deleteCategory, saveCategory, setCategoryActive } from "@/features/admin/actions";
import { cn } from "@/lib/utils";
import { ReferenceAction, ReferenceDialog } from "./reference-dialog";

type Category = {
  id: string;
  parent_id: string | null;
  name_fr: string;
  name_ar: string;
  position: number;
  is_active: boolean;
};

export function CategoryRow({ category, childLevel }: { category: Category; childLevel?: boolean }) {
  const t = useTranslations("adminReference");
  // Les deux noms restent affichés pour les modifier ; les titres des fenêtres suivent la langue de l'interface.
  const name = useLocale() === "ar" ? category.name_ar : category.name_fr;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-2", childLevel && "ps-4")}>
      <p className={cn("min-w-0 flex-1", !childLevel && "font-semibold", !category.is_active && "text-muted-foreground line-through")}>
        <span lang="fr" dir="ltr">{category.name_fr}</span> · <span lang="ar" dir="rtl">{category.name_ar}</span>
      </p>
      <div className="flex flex-wrap gap-1">
        {!childLevel ? (
          <ReferenceDialog
            trigger={t("addChild")}
            title={t("addChildTo", { name })}
            withPosition
            onSave={(values) => saveCategory({ id: null, parentId: category.id, ...values })}
          />
        ) : null}
        <ReferenceDialog
          trigger={t("edit")}
          title={t("editName", { name })}
          variant="ghost"
          withPosition
          initial={{ nameFr: category.name_fr, nameAr: category.name_ar, position: category.position }}
          onSave={(values) => saveCategory({ id: category.id, parentId: category.parent_id, ...values })}
        />
        <ReferenceAction
          label={category.is_active ? t("disable") : t("enable")}
          run={() => setCategoryActive(category.id, !category.is_active)}
        />
        <ReferenceAction label={t("delete")} run={() => deleteCategory(category.id)} />
      </div>
    </div>
  );
}

export function NewCategoryButton() {
  const t = useTranslations("adminReference");

  return (
    <ReferenceDialog
      trigger={t("addCategory")}
      title={t("addCategory")}
      variant="default"
      withPosition
      onSave={(values) => saveCategory({ id: null, parentId: null, ...values })}
    />
  );
}
