import "server-only";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategories, searchTokens } from "./queries";

export type Suggestions = {
  categories: { slug: string; label: string }[];
  brands: string[];
  pieces: { id: string; title: string }[];
};

const EMPTY: Suggestions = { categories: [], brands: [], pieces: [] };

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

// Les suggestions de la recherche du catalogue : de vraies catégories, de vraies marques et de vraies
// pièces publiées. Rien n'est inventé ; sans résultat, la liste reste vide.
export async function getSuggestions(query: string, locale: string): Promise<Suggestions> {
  const text = query.trim();
  if (text.length < 2) return EMPTY;

  const tokens = searchTokens(text);
  const folded = fold(text);
  const supabase = createPublicClient();

  let titles = supabase
    .from("products")
    .select("id, title")
    .eq("publication_status", "published")
    .in("status", ["available", "reserved"])
    .order("published_at", { ascending: false })
    .limit(5);
  for (const token of tokens) titles = titles.ilike("search_text", `%${escapeLike(token)}%`);

  const [categories, brands, pieces] = await Promise.all([
    getCategories("mode").catch(() => []),
    supabase
      .from("products")
      .select("brand")
      .eq("publication_status", "published")
      .in("status", ["available", "reserved"])
      .ilike("brand", `%${escapeLike(text)}%`)
      .limit(40),
    titles,
  ]);

  const name = (category: { nameFr: string; nameAr: string }) => (locale === "ar" ? category.nameAr : category.nameFr);
  const seen = new Set<string>();

  return {
    categories: categories
      .filter((category) => fold(category.nameFr).includes(folded) || category.nameAr.includes(text))
      .slice(0, 4)
      .map((category) => ({ slug: category.slug, label: name(category) })),
    // Une marque n'apparaît qu'une fois, quelle que soit sa casse.
    brands: (brands.data ?? [])
      .map((row) => row.brand?.trim() ?? "")
      .filter((brand) => brand && !seen.has(brand.toLowerCase()) && seen.add(brand.toLowerCase()))
      .slice(0, 4),
    pieces: (pieces.data ?? []).filter((row) => row.title).map((row) => ({ id: row.id, title: row.title as string })),
  };
}
