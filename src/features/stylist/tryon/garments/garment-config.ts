// Le type précis de chaque pièce et la façon de la porter. Le type vient de la catégorie de l'annonce,
// affiné par son titre ; quand rien ne permet de trancher (la sous-catégorie « jupes-shorts » sans mot
// clair dans le titre), il reste inconnu : la forme de la photo décidera, ou personne.
import type { Gender, Slot } from "../../engine";

export const GARMENT_KINDS = [
  "tshirt",
  "polo",
  "shirt",
  "knit",
  "top",
  "jacket",
  "coat",
  "jeans",
  "pants",
  "shorts",
  "skirt",
  "dress",
  "shoes",
  "bag",
  "hat",
  "belt",
  "accessory",
] as const;
export type GarmentKind = (typeof GARMENT_KINDS)[number];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const has = (text: string, words: string[]) => words.some((word) => new RegExp(`(^|[^a-z])${word}`).test(text));

// La forme courte : jupe ou short, d'après les mots du titre. null si le titre ne dit rien, ou les deux.
export function shortBottomFromTitle(title: string): "shorts" | "skirt" | null {
  const text = normalize(title);
  const skirt = has(text, ["jupe", "skirt", "jupette", "تنورة", "تنوره", "جيبة", "جيبه"]);
  const shorts = has(text, ["short", "bermuda", "شورت", "برمودا"]);
  if (skirt === shorts) return null;
  return skirt ? "skirt" : "shorts";
}

export function classifyGarment({ rootSlug, subSlug, title }: { rootSlug?: string | null; subSlug?: string | null; title: string }): GarmentKind | null {
  const text = normalize(title);
  switch (rootSlug) {
    case "hauts":
      if (has(text, ["polo"])) return "polo";
      if (subSlug === "chemises" || has(text, ["chemise", "blouse"])) return "shirt";
      if (subSlug === "pulls-sweats" || has(text, ["pull", "sweat", "hoodie", "gilet", "cardigan"])) return "knit";
      if (has(text, ["debardeur", "top", "crop", "caraco", "body", "bustier"])) return "top";
      return subSlug === "t-shirts" || has(text, ["t-shirt", "tshirt", "tee"]) ? "tshirt" : "top";
    case "vestes-manteaux":
      return subSlug === "manteaux" || has(text, ["manteau", "trench", "parka", "doudoune"]) ? "coat" : "jacket";
    case "robes":
      return "dress";
    case "bas": {
      const short = shortBottomFromTitle(title);
      if (subSlug === "jupes-shorts") return short;
      if (short) return short;
      return subSlug === "jeans" || has(text, ["jean"]) ? "jeans" : "pants";
    }
    case "chaussures":
    case "sneakers":
      return "shoes";
    case "accessoires":
      if (subSlug === "sacs" || has(text, ["sac", "pochette", "cabas"])) return "bag";
      if (subSlug === "casquettes-bonnets" || has(text, ["casquette", "bonnet", "chapeau"])) return "hat";
      if (subSlug === "ceintures" || has(text, ["ceinture"])) return "belt";
      return "accessory";
    default:
      return null;
  }
}

// Les pièces que le mannequin homme ne porte pas (la liste de la cabine homme : pas de jupe, pas de robe).
const WOMEN_ONLY: GarmentKind[] = ["skirt", "dress"];

export function kindSuits(kind: GarmentKind | null | undefined, gender: Gender) {
  return gender === "femme" || !kind || !WOMEN_ONLY.includes(kind);
}

// Comment la pièce se porte sur le mannequin.
// - wrap « body » : le tissu épouse le corps ; « hang » : sous les hanches, il tombe (jupe, robe) ;
//   « foot » : enfilé sur le pied ; « card » : tenu à la main (sac, accessoire).
// - band : les rangées de la photo qui donnent la largeur de référence (fractions de la hauteur) ;
//   target : la mesure du corps qui lui correspond ; ease : l'aisance du vêtement.
// - layer : l'épaisseur au-dessus du corps (en mètres) : la veste passe sur le haut, le haut sur le bas.
export type FitRule = {
  wrap: "body" | "hang" | "foot" | "card";
  anchor: "neck" | "waist" | "feet" | "hand" | "head";
  band: [number, number];
  target: "chest" | "waist" | "head" | "foot" | "fixed";
  ease: number;
  fixedWidth?: number;
  layer: number;
};

const TOP: FitRule = { wrap: "body", anchor: "neck", band: [0.48, 0.78], target: "chest", ease: 1.1, layer: 0.009 };
const BOTTOM: FitRule = { wrap: "body", anchor: "waist", band: [0, 0.06], target: "waist", ease: 1.06, layer: 0.005 };

export const FIT_RULES: Record<GarmentKind | "unknownBottom", FitRule> = {
  tshirt: TOP,
  polo: TOP,
  shirt: TOP,
  knit: { ...TOP, ease: 1.14 },
  top: TOP,
  jacket: { ...TOP, band: [0.5, 0.72], ease: 1.22, layer: 0.024 },
  coat: { ...TOP, wrap: "hang", band: [0.32, 0.5], ease: 1.24, layer: 0.026 },
  dress: { wrap: "hang", anchor: "neck", band: [0.18, 0.32], target: "chest", ease: 1.06, layer: 0.007 },
  jeans: BOTTOM,
  pants: BOTTOM,
  shorts: BOTTOM,
  skirt: { ...BOTTOM, wrap: "hang" },
  // Jupe ou short, on ne sait pas : le tissu tombe des hanches, sans être forcé dans l'un ou l'autre.
  unknownBottom: { ...BOTTOM, wrap: "hang" },
  shoes: { wrap: "foot", anchor: "feet", band: [0, 1], target: "foot", ease: 1.12, layer: 0.004 },
  hat: { wrap: "body", anchor: "head", band: [0.7, 1], target: "head", ease: 1.06, layer: 0.008 },
  bag: { wrap: "card", anchor: "hand", band: [0, 1], target: "fixed", ease: 1, fixedWidth: 0.3, layer: 0 },
  belt: { wrap: "card", anchor: "hand", band: [0, 1], target: "fixed", ease: 1, fixedWidth: 0.2, layer: 0 },
  accessory: { wrap: "card", anchor: "hand", band: [0, 1], target: "fixed", ease: 1, fixedWidth: 0.2, layer: 0 },
};

// Le type retenu pour le rendu : celui de l'annonce, ou à défaut celui de la case.
export function ruleKey(kind: GarmentKind | null | undefined, slot: Slot): GarmentKind | "unknownBottom" {
  if (kind) return kind;
  return ({ top: "top", outer: "jacket", dress: "dress", bottom: "unknownBottom", shoes: "shoes", accessory: "accessory" } as const)[slot];
}
