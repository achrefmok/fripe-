import { parsePriceToMillimes } from "@/lib/utils/price";
import type { ProductCondition } from "./constants";
import { csvRowSchema, normalizeCondition } from "./schemas";

export type CategoryOption = { id: string; slug: string; nameFr: string; nameAr: string };

export type CsvRowResult =
  | {
      line: number;
      ok: true;
      product: {
        title: string;
        category_id: string;
        price_millimes: number;
        condition: ProductCondition | null;
        brand: string | null;
        size: string | null;
        color: string | null;
        reference: string | null;
        description: string | null;
        defects: string | null;
      };
    }
  | { line: number; ok: false; error: string };

function findCategory(value: string, categories: CategoryOption[]) {
  const key = value.trim().toLowerCase();

  return categories.find(
    (category) =>
      category.slug === key ||
      category.nameFr.toLowerCase() === key ||
      category.nameAr === value.trim(),
  );
}

// Partagé entre l'aperçu navigateur et le serveur, qui refait toujours la validation.
export function validateCsvRows(
  rows: Record<string, string>[],
  categories: CategoryOption[],
): CsvRowResult[] {
  return rows.map((row, index): CsvRowResult => {
    const line = index + 2;
    const parsed = csvRowSchema.safeParse(row);

    if (!parsed.success) {
      return { line, ok: false, error: parsed.error.issues[0].message };
    }

    const { data } = parsed;
    const price = parsePriceToMillimes(data.prix);
    if (price === null) return { line, ok: false, error: "priceInvalid" };

    const category = findCategory(data.categorie, categories);
    if (!category) return { line, ok: false, error: "categoryUnknown" };

    const condition = data.etat ? normalizeCondition(data.etat) : null;
    if (data.etat && !condition) return { line, ok: false, error: "conditionUnknown" };

    return {
      line,
      ok: true,
      product: {
        title: data.titre,
        category_id: category.id,
        price_millimes: price,
        condition,
        brand: data.marque || null,
        size: data.taille || null,
        color: data.couleur || null,
        reference: data.reference || null,
        description: data.description || null,
        defects: data.defauts || null,
      },
    };
  });
}
