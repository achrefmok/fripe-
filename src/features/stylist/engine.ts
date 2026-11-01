// Moteur de recommandation déterministe : mêmes entrées, mêmes tenues. Aucun service externe.
// `StylistEngine` permettra de brancher un modèle plus tard sans toucher à l'interface.

export const SLOTS = ["top", "bottom", "shoes", "accessory"] as const;
export type Slot = (typeof SLOTS)[number];

export const STYLES = ["streetwear", "casual", "chic", "sport", "vintage"] as const;
export type Style = (typeof STYLES)[number];

export const OCCASIONS = ["everyday", "work", "evening", "sport"] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const COLORS = ["noir", "blanc", "gris", "bleu", "rouge", "vert", "beige", "marron", "rose", "jaune"] as const;
export type Color = (typeof COLORS)[number];

export type StyleItem = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  color: string | null;
  description: string | null;
  priceMillimes: number;
  slot: Slot;
  categoryId: string;
  shopName: string;
  imagePath: string | null;
};

export type StylistInput = {
  size: string;
  shoeSize: string;
  budgetMillimes: number;
  style: Style | "";
  occasion: Occasion | "";
  colors: Color[];
};

export type RecommendedOutfit = {
  items: StyleItem[];
  totalMillimes: number;
  score: number;
};

export interface StylistEngine {
  recommend(input: StylistInput, catalog: StyleItem[]): RecommendedOutfit[];
}

const ROOT_TO_SLOT: Record<string, Slot> = {
  hauts: "top",
  "vestes-manteaux": "top",
  robes: "top",
  bas: "bottom",
  chaussures: "shoes",
  accessoires: "accessory",
};

export function slotOfCategory(rootSlug: string | undefined): Slot | null {
  return (rootSlug && ROOT_TO_SLOT[rootSlug]) || null;
}

const STYLE_WORDS: Record<Style, string[]> = {
  streetwear: ["street", "hoodie", "sweat", "capuche", "jordan", "cargo", "oversize", "baggy", "casquette", "nike", "supreme", "stussy"],
  casual: ["t-shirt", "tshirt", "polo", "jean", "basket", "chemise", "pull"],
  chic: ["blazer", "costume", "robe", "manteau", "chemise", "cuir", "soie", "lin", "mocassin", "talon"],
  sport: ["jogging", "survetement", "short", "running", "adidas", "nike", "puma", "training", "sport"],
  vintage: ["vintage", "retro", "levis", "velours", "90", "80", "wrangler", "lee"],
};

const OCCASION_WORDS: Record<Occasion, string[]> = {
  everyday: ["t-shirt", "jean", "basket", "sweat", "pull", "polo"],
  work: ["chemise", "blazer", "pantalon", "mocassin", "costume"],
  evening: ["robe", "blazer", "cuir", "talon", "soie", "chemise"],
  sport: ["jogging", "short", "running", "survetement", "basket", "sport"],
};

const COLOR_WORDS: Record<Color, string[]> = {
  noir: ["noir", "black", "اسود", "أسود"],
  blanc: ["blanc", "white", "ابيض", "أبيض"],
  gris: ["gris", "grey", "gray", "رمادي"],
  bleu: ["bleu", "blue", "marine", "navy", "ازرق", "أزرق"],
  rouge: ["rouge", "red", "bordeaux", "احمر", "أحمر"],
  vert: ["vert", "green", "kaki", "اخضر", "أخضر"],
  beige: ["beige", "creme", "ecru", "بيج"],
  marron: ["marron", "brown", "camel", "بني"],
  rose: ["rose", "pink", "وردي"],
  jaune: ["jaune", "yellow", "moutarde", "اصفر", "أصفر"],
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function textOf(item: StyleItem) {
  return normalize([item.title, item.brand, item.color, item.description].filter(Boolean).join(" "));
}

function sameSize(item: StyleItem, size: string) {
  return normalize(item.size ?? "").trim() === normalize(size).trim();
}

export function fitsInput(item: StyleItem, input: StylistInput) {
  if (item.slot === "accessory") return true;
  if (item.slot === "shoes") return !input.shoeSize || sameSize(item, input.shoeSize);
  return !input.size || sameSize(item, input.size);
}

function countMatches(text: string, words: string[]) {
  return words.filter((word) => text.includes(normalize(word))).length;
}

export function scoreItem(item: StyleItem, input: StylistInput) {
  const text = textOf(item);
  const colorText = normalize(item.color ?? "");
  let score = 0;

  for (const color of input.colors) {
    const words = COLOR_WORDS[color];
    if (countMatches(colorText, words)) score += 4;
    else if (countMatches(text, words)) score += 2;
  }

  if (input.style) score += Math.min(countMatches(text, STYLE_WORDS[input.style]), 2) * 2;
  if (input.occasion) score += Math.min(countMatches(text, OCCASION_WORDS[input.occasion]), 2) * 2;

  return score;
}

const CANDIDATES_PER_SLOT = { top: 6, bottom: 6, shoes: 4, accessory: 4 };

function bySlot(catalog: StyleItem[], input: StylistInput) {
  const groups = new Map<Slot, { item: StyleItem; score: number }[]>();

  for (const item of catalog) {
    if (!fitsInput(item, input) || item.priceMillimes > input.budgetMillimes) continue;

    const entries = groups.get(item.slot) ?? [];
    entries.push({ item, score: scoreItem(item, input) });
    groups.set(item.slot, entries);
  }

  const ordered = new Map<Slot, { item: StyleItem; score: number }[]>();

  for (const [slot, entries] of groups) {
    entries.sort(
      (a, b) =>
        b.score - a.score ||
        a.item.priceMillimes - b.item.priceMillimes ||
        a.item.id.localeCompare(b.item.id),
    );
    ordered.set(slot, entries.slice(0, CANDIDATES_PER_SLOT[slot]));
  }

  return ordered;
}

const deterministicEngine: StylistEngine = {
  recommend(input, catalog) {
    const groups = bySlot(catalog, input);
    const tops = groups.get("top") ?? [];
    const bottoms = groups.get("bottom") ?? [];
    const shoes = [null, ...(groups.get("shoes") ?? [])];
    const accessories = [null, ...(groups.get("accessory") ?? [])];
    const outfits: RecommendedOutfit[] = [];

    for (const top of tops) {
      for (const bottom of bottoms) {
        for (const shoe of shoes) {
          for (const accessory of accessories) {
            const parts = [top, bottom, shoe, accessory].filter((part) => part !== null);
            const total = parts.reduce((sum, part) => sum + part.item.priceMillimes, 0);

            if (total > input.budgetMillimes) continue;

            outfits.push({
              items: parts.map((part) => part.item),
              totalMillimes: total,
              score: parts.reduce((sum, part) => sum + part.score + 1, 0),
            });
          }
        }
      }
    }

    outfits.sort(
      (a, b) =>
        b.score - a.score ||
        a.totalMillimes - b.totalMillimes ||
        a.items.map((item) => item.id).join().localeCompare(b.items.map((item) => item.id).join()),
    );

    // Trois propositions réellement différentes : une pièce unique ne sert qu'une fois.
    const chosen: RecommendedOutfit[] = [];
    const used = new Set<string>();

    for (const outfit of outfits) {
      if (outfit.items.some((item) => used.has(item.id))) continue;

      chosen.push(outfit);
      outfit.items.forEach((item) => used.add(item.id));

      if (chosen.length === 3) break;
    }

    return chosen;
  },
};

export function getStylistEngine(): StylistEngine {
  return deterministicEngine;
}

export function outfitTotal(items: { priceMillimes: number }[]) {
  return items.reduce((sum, item) => sum + item.priceMillimes, 0);
}

// Remplace chaque pièce par la meilleure alternative moins chère de la même catégorie.
export function findCheaperOutfit(items: StyleItem[], catalog: StyleItem[]) {
  const selected = new Set(items.map((item) => item.id));

  const replaced = items.map((item) => {
    const alternatives = catalog
      .filter(
        (candidate) =>
          candidate.slot === item.slot &&
          candidate.categoryId === item.categoryId &&
          candidate.priceMillimes < item.priceMillimes &&
          !selected.has(candidate.id),
      )
      .map((candidate) => ({
        candidate,
        score:
          (item.color && normalize(candidate.color ?? "") === normalize(item.color) ? 3 : 0) +
          (item.brand && normalize(candidate.brand ?? "") === normalize(item.brand) ? 2 : 0) +
          (item.size && candidate.size && sameSize(candidate, item.size) ? 2 : 0),
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.candidate.priceMillimes - b.candidate.priceMillimes ||
          a.candidate.id.localeCompare(b.candidate.id),
      );

    const best = alternatives[0]?.candidate;
    if (best) selected.add(best.id);

    return best ?? item;
  });

  const saving = outfitTotal(items) - outfitTotal(replaced);

  return saving > 0 ? { items: replaced, savingMillimes: saving } : null;
}
