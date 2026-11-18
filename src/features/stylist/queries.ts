import "server-only";
import { getCategories } from "@/features/catalog/queries";
import { createPublicClient } from "@/lib/supabase/public";
import { type Gender, slotOfCategory, type Slot, type StyleItem, suitsGender } from "./engine";
import { classifyGarment } from "./tryon/garments/garment-config";

const CATALOG_LIMIT = 500;

type RawItem = {
  id: string;
  title: string | null;
  brand: string | null;
  size: string | null;
  color: string | null;
  description: string | null;
  price_millimes: number | null;
  category_id: string | null;
  attributes: Record<string, unknown> | null;
  shops: { name: string };
  product_images: { path: string; position: number }[];
};

// Seules les pièces publiées et disponibles entrent dans le moteur : rien n'est inventé.
export async function getStyleCatalog(options: { slot?: Slot; search?: string; ids?: string[]; gender?: Gender | null } = {}) {
  const supabase = createPublicClient();
  const categories = await getCategories();
  const slugOf = new Map(categories.map((category) => [category.id, category.slug]));
  const rootOf = new Map(
    categories.map((category) => [
      category.id,
      category.parentId
        ? categories.find((parent) => parent.id === category.parentId)?.slug
        : category.slug,
    ]),
  );

  let query = supabase
    .from("products")
    .select(
      "id, title, brand, size, color, description, price_millimes, category_id, attributes, shops!inner (name), product_images (path, position)",
    )
    .eq("publication_status", "published")
    .eq("status", "available")
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .order("published_at", { ascending: false })
    .limit(CATALOG_LIMIT);

  if (options.ids) query = query.in("id", options.ids);

  if (options.search) {
    const term = options.search
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[\\%_]/g, "\\$&");

    query = query.ilike("search_text", `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as RawItem[]).flatMap((row): StyleItem[] => {
    const rootSlug = rootOf.get(row.category_id ?? "");
    const slot = slotOfCategory(rootSlug);

    if (!slot || !row.title || !row.price_millimes || !row.category_id) return [];
    if (options.slot && slot !== options.slot) return [];
    const genre = typeof row.attributes?.genre === "string" ? row.attributes.genre : null;
    if (!suitsGender({ gender: genre }, options.gender ?? null)) return [];
    const ownSlug = slugOf.get(row.category_id);

    return [
      {
        id: row.id,
        title: row.title,
        brand: row.brand,
        size: row.size,
        color: row.color,
        description: row.description,
        priceMillimes: row.price_millimes,
        slot,
        categoryId: row.category_id,
        shopName: row.shops.name,
        imagePath: row.product_images[0]?.path ?? null,
        kind: classifyGarment({ rootSlug, subSlug: ownSlug === rootSlug ? null : ownSlug, title: row.title }),
        gender: genre,
      },
    ];
  });
}
