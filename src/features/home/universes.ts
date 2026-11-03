export type GarmentKind = "top" | "bottom" | "coat" | "dress" | "shoes" | "accessory" | "tag";

export type Universe = {
  garment: GarmentKind;
  // Aplat de l'univers, et texte lisible dessus.
  surface: string;
  ink: string;
  // Le tissu suspendu, plus clair que l'aplat pour ressortir sur le fond du dressing.
  cloth: string;
  seam: string;
};

const INK = "oklch(0.2 0.014 55)";
const PAPER = "oklch(0.97 0.012 85)";

// Chaque catégorie racine a sa matière : harissa, denim, kraft, garance, olive, ocre.
const UNIVERSES: Record<string, Universe> = {
  hauts: { garment: "top", surface: "oklch(0.5 0.185 31)", ink: PAPER, cloth: "oklch(0.6 0.19 31)", seam: "oklch(0.42 0.15 31)" },
  bas: { garment: "bottom", surface: "oklch(0.38 0.075 255)", ink: PAPER, cloth: "oklch(0.52 0.09 252)", seam: "oklch(0.76 0.09 75)" },
  "vestes-manteaux": { garment: "coat", surface: "oklch(0.74 0.085 72)", ink: INK, cloth: "oklch(0.6 0.09 66)", seam: "oklch(0.42 0.07 62)" },
  robes: { garment: "dress", surface: "oklch(0.47 0.135 5)", ink: PAPER, cloth: "oklch(0.62 0.14 8)", seam: "oklch(0.42 0.12 5)" },
  chaussures: { garment: "shoes", surface: "oklch(0.4 0.06 125)", ink: PAPER, cloth: "oklch(0.93 0.02 88)", seam: "oklch(0.5 0.07 125)" },
  accessoires: { garment: "accessory", surface: "oklch(0.76 0.125 82)", ink: INK, cloth: "oklch(0.58 0.12 60)", seam: "oklch(0.42 0.09 55)" },
};

// Une catégorie ajoutée dans l'administration prend l'étiquette, sans rien casser.
const DEFAULT_UNIVERSE: Universe = {
  garment: "tag",
  surface: "oklch(0.74 0.085 72)",
  ink: INK,
  cloth: "oklch(0.6 0.09 66)",
  seam: "oklch(0.42 0.07 62)",
};

export function universeFor(slug: string): Universe {
  return UNIVERSES[slug] ?? DEFAULT_UNIVERSE;
}
