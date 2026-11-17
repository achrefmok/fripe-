export const CONDITIONS = ["new_with_tags", "new_without_tags", "like_new", "very_good", "good", "fair"] as const;

export type ProductCondition = (typeof CONDITIONS)[number];

export const CATALOG_PAGE_SIZE = 24;
// Sous la limite de 4,5 Mo des fonctions Vercel, qui transportent ces envois.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_CSV_ROWS = 500;
export const MAX_BULK_IMAGES = 30;

export const SORTS = ["recent", "popular", "price_asc", "price_desc"] as const;
export type CatalogSort = (typeof SORTS)[number];
