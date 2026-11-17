// Les choix proposés au vendeur, selon le type de pièce. Aucune saisie n'est imposée :
// une taille ou une marque absente des listes reste possible en texte libre.

export type ProductKind = "clothing" | "shoes" | "accessories" | "other";

const CLOTHING_ROOTS = new Set(["hauts", "bas", "vestes-manteaux", "robes"]);

export function productKind(rootSlug: string | null | undefined): ProductKind {
  if (!rootSlug) return "other";
  if (CLOTHING_ROOTS.has(rootSlug)) return "clothing";
  // Sneakers regroupe les baskets depuis la migration 20261116000001 : mêmes pointures que Chaussures.
  if (rootSlug === "chaussures" || rootSlug === "sneakers") return "shoes";
  if (rootSlug === "accessoires") return "accessories";
  return "other";
}

export const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
export const NUMBER_SIZES = ["34", "36", "38", "40", "42", "44", "46", "48"];
export const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];
export const ONE_SIZE = { fr: "Taille unique", ar: "مقاس موحد" };

// La valeur enregistrée reste le nom français, stable pour la recherche ; l'affichage suit la langue.
export const COLORS = [
  { value: "Noir", ar: "أسود", swatch: "#1d1a17" },
  { value: "Blanc", ar: "أبيض", swatch: "#f7f4ec" },
  { value: "Gris", ar: "رمادي", swatch: "#8d8a85" },
  { value: "Beige", ar: "بيج", swatch: "#d9c7a3" },
  { value: "Marron", ar: "بني", swatch: "#6e4a2f" },
  { value: "Bleu", ar: "أزرق", swatch: "#2f5fa8" },
  { value: "Marine", ar: "كحلي", swatch: "#1f2c4d" },
  { value: "Vert", ar: "أخضر", swatch: "#3f7a4a" },
  { value: "Kaki", ar: "كاكي", swatch: "#77704a" },
  { value: "Rouge", ar: "أحمر", swatch: "#b8322a" },
  { value: "Bordeaux", ar: "عنابي", swatch: "#6d1f2b" },
  { value: "Rose", ar: "وردي", swatch: "#e59bb0" },
  { value: "Jaune", ar: "أصفر", swatch: "#e8c23a" },
  { value: "Orange", ar: "برتقالي", swatch: "#e2792f" },
  { value: "Violet", ar: "بنفسجي", swatch: "#6b4a8f" },
  { value: "Multicolore", ar: "متعدد الألوان", swatch: "conic-gradient(#b8322a, #e8c23a, #3f7a4a, #2f5fa8, #6b4a8f, #b8322a)" },
] as const;

export function colorLabel(value: string | null | undefined, locale: string) {
  if (!value) return value ?? null;
  const known = COLORS.find((color) => color.value.toLowerCase() === value.toLowerCase());
  return known && locale === "ar" ? known.ar : value;
}

const BRANDS: Record<ProductKind, string[]> = {
  clothing: ["Zara", "H&M", "Mango", "Levi's", "Nike", "Adidas", "Lacoste", "Tommy Hilfiger", "Ralph Lauren", "Pull&Bear", "Bershka", "Massimo Dutti", "Calvin Klein", "Carhartt", "The North Face", "Guess", "Diesel", "Uniqlo"],
  shoes: ["Nike", "Adidas", "Puma", "New Balance", "Converse", "Vans", "Reebok", "Timberland", "Dr. Martens", "Clarks", "Skechers", "Geox"],
  accessories: ["Ray-Ban", "Michael Kors", "Guess", "Fossil", "Casio", "Longchamp", "Zara", "Mango", "Lacoste"],
  other: [],
};

// Les marques déjà utilisées par la boutique d'abord, puis les plus courantes du type.
export function brandSuggestions(kind: ProductKind, shopBrands: string[]) {
  const seen = new Set<string>();
  return [...shopBrands, ...BRANDS[kind]].filter((brand) => {
    const key = brand.toLowerCase();
    if (!brand || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
