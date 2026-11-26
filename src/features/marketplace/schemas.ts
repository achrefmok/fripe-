import { z } from "zod";
import { audienceParam } from "@/features/catalog/audience";
import { CONDITIONS } from "@/features/catalog/constants";
import { parsePriceToMillimes } from "@/lib/utils/price";

export const LISTING_SECTIONS = ["marketplace", "vide_dressing"] as const;
export type ListingSection = (typeof LISTING_SECTIONS)[number];

export const MARKET_SORTS = ["recent", "price_asc", "price_desc"] as const;
export const SELLER_TYPES = ["particulier", "pro"] as const;

export const MARKET_PAGE_SIZE = 24;
export const MAX_LISTING_IMAGES = 10;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "textTooLong")
    .transform((value) => value || null);

const price = z
  .string()
  .trim()
  .transform((value, context) => {
    const millimes = parsePriceToMillimes(value);
    if (millimes === null) {
      context.addIssue({ code: "custom", message: "priceInvalid" });
      return z.NEVER;
    }
    return millimes;
  });

// Une annonce est complète dès sa création : un particulier n'a pas de brouillon à finir plus tard.
export const listingSchema = z
  .object({
    section: z.enum(LISTING_SECTIONS),
    categoryId: z.uuid("categoryRequired"),
    title: z.string().trim().min(3, "nameTooShort").max(120, "textTooLong"),
    description: z.string().trim().max(3000, "textTooLong"),
    brand: optionalText(60),
    size: optionalText(20),
    condition: z.enum(CONDITIONS, "conditionRequired"),
    price,
    governorateId: z.coerce.number("governorateRequired").int().positive("governorateRequired"),
    cityId: z.union([z.coerce.number().int().positive(), z.literal("")]).transform((value) => value || null),
    attributes: z
      .record(z.string().regex(/^[a-z][a-z0-9_]{1,30}$/), z.string().trim().max(60, "textTooLong"))
      .transform((value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== "")))
      .refine((value) => Object.keys(value).length <= 12, "invalidAttributes"),
    // Les défauts se déclarent toujours : une description, ou « aucun défaut » coché explicitement.
    defects: z.string().trim().max(500, "textTooLong").default(""),
    noDefects: z.boolean().default(false),
  })
  .superRefine((data, context) => {
    if (!data.noDefects && !data.defects) context.addIssue({ code: "custom", path: ["defects"], message: "defectsRequired" });
  });

export type ListingInput = z.input<typeof listingSchema>;

export const messageSchema = z.string().trim().min(1, "messageEmpty").max(1000, "textTooLong");

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const text = (max: number) => z.preprocess(firstValue, z.string().trim().max(max).catch("").default(""));

export const marketFiltersSchema = z.object({
  q: text(80),
  categorie: text(60),
  etat: z.preprocess(firstValue, z.enum(CONDITIONS).optional().catch(undefined)),
  gouvernorat: text(10),
  prixMin: text(10),
  prixMax: text(10),
  marque: text(60),
  taille: text(20),
  pour: audienceParam,
  vendeur: z.preprocess(firstValue, z.enum(SELLER_TYPES).optional().catch(undefined)),
  tri: z.preprocess(firstValue, z.enum(MARKET_SORTS).catch("recent").default("recent")),
  page: z.preprocess(firstValue, z.coerce.number().int().min(1).max(500).catch(1).default(1)),
});

export type MarketFilters = z.infer<typeof marketFiltersSchema> & { attributes: Record<string, string> };

// Les filtres propres à une catégorie arrivent en « a_cle=valeur » ; seules les clés bien formées passent.
export function parseMarketFilters(params: Record<string, string | string[] | undefined>): MarketFilters {
  const base = marketFiltersSchema.parse(params);
  const attributes: Record<string, string> = {};

  for (const [name, raw] of Object.entries(params)) {
    const key = name.startsWith("a_") ? name.slice(2) : null;
    const value = String(firstValue(raw) ?? "").trim();
    if (key && /^[a-z][a-z0-9_]{1,30}$/.test(key) && value && value.length <= 60) attributes[key] = value;
    if (Object.keys(attributes).length >= 6) break;
  }

  return { ...base, attributes };
}
