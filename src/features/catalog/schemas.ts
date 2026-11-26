import { z } from "zod";
import { parsePriceToMillimes } from "@/lib/utils/price";
import { audienceParam } from "./audience";
import { CONDITIONS, SORTS } from "./constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "textTooLong")
    .transform((value) => value || null);

const priceField = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;

    const millimes = parsePriceToMillimes(value);
    if (millimes === null) {
      context.addIssue({ code: "custom", message: "priceInvalid" });
      return z.NEVER;
    }

    return millimes;
  });

const titleField = z
  .string()
  .trim()
  .max(120, "textTooLong")
  .refine((value) => value === "" || value.length >= 2, "nameTooShort")
  .transform((value) => value || null);

const conditionField = z.union([z.enum(CONDITIONS), z.literal("")]).transform((value) => value || null);
const categoryField = z.union([z.uuid(), z.literal("")]).transform((value) => value || null);

// Un brouillon peut être incomplet : c'est la publication qui exige tous les champs.
export const productSchema = z.object({
  title: titleField,
  categoryId: categoryField,
  condition: conditionField,
  price: priceField,
  brand: optionalText(60),
  size: optionalText(20),
  color: optionalText(40),
  reference: optionalText(40),
  description: optionalText(2000),
  defects: optionalText(500),
  attributes: z
    .record(z.string().regex(/^[a-z][a-z0-9_]{1,30}$/), z.string().trim().max(60, "textTooLong"))
    .optional()
    .transform((value) => Object.fromEntries(Object.entries(value ?? {}).filter(([, entry]) => entry !== "")))
    .refine((value) => Object.keys(value).length <= 12, "invalid_attributes"),
});

export const productIdsSchema = z.array(z.uuid()).min(1).max(500);

export const bulkPatchSchema = z.object({
  price: priceField,
  categoryId: categoryField,
  condition: conditionField,
});

export const draftRowSchema = z.object({ title: titleField, price: priceField });

export const collectionSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
  description: optionalText(500),
  isPublished: z.boolean(),
});

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const text = (max: number) =>
  z.preprocess(firstValue, z.string().trim().max(max).catch("").default(""));

export const catalogFiltersSchema = z.object({
  q: text(80),
  categorie: text(60),
  taille: text(20),
  marque: text(60),
  etat: z.preprocess(firstValue, z.enum(CONDITIONS).optional().catch(undefined)),
  gouvernorat: text(40),
  pour: audienceParam,
  prixMin: text(10),
  prixMax: text(10),
  tri: z.preprocess(firstValue, z.enum(SORTS).catch("recent").default("recent")),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(1000).catch(1).default(1)),
});

export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;

// Colonnes CSV en français : le fichier est rempli par les vendeurs, souvent dans Excel.
const CONDITION_ALIASES: Record<string, (typeof CONDITIONS)[number]> = {
  "neuf avec etiquette": "new_with_tags",
  "neuf sans etiquette": "new_without_tags",
  neuf: "new_with_tags",
  "comme neuf": "like_new",
  "tres bon": "very_good",
  "tres bon etat": "very_good",
  bon: "good",
  "bon etat": "good",
  correct: "fair",
  "etat correct": "fair",
};

export function normalizeCondition(value: string) {
  const key = value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return CONDITIONS.find((condition) => condition === key) ?? CONDITION_ALIASES[key] ?? null;
}

export const csvRowSchema = z.object({
  titre: z.string().trim().min(2, "nameTooShort").max(120, "textTooLong"),
  categorie: z.string().trim().min(1, "categoryRequired"),
  prix: z.string().trim().min(1, "priceInvalid"),
  etat: z.string().trim().default(""),
  marque: z.string().trim().max(60, "textTooLong").default(""),
  taille: z.string().trim().max(20, "textTooLong").default(""),
  couleur: z.string().trim().max(40, "textTooLong").default(""),
  reference: z.string().trim().max(40, "textTooLong").default(""),
  description: z.string().trim().max(2000, "textTooLong").default(""),
  defauts: z.string().trim().max(500, "textTooLong").default(""),
});
