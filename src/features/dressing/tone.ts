// Chaque dressing a sa matière, tirée de son identifiant : la même personne garde toujours la même
// teinte, sans rien stocker. Le texte posé dessus dépasse 4,5:1.
const TONES = [
  { surface: "oklch(0.36 0.09 22)", ink: "oklch(0.96 0.015 85)" }, // garance
  { surface: "oklch(0.3 0.05 250)", ink: "oklch(0.96 0.015 85)" }, // denim
  { surface: "oklch(0.38 0.06 135)", ink: "oklch(0.96 0.015 85)" }, // olive
  { surface: "oklch(0.44 0.09 55)", ink: "oklch(0.97 0.012 85)" }, // cuir
  { surface: "oklch(0.34 0.07 320)", ink: "oklch(0.96 0.015 85)" }, // prune
  { surface: "oklch(0.24 0.012 60)", ink: "oklch(0.96 0.015 85)" }, // nuit
] as const;

export type DressingTone = (typeof TONES)[number];

export function dressingTone(sellerId: string): DressingTone {
  let hash = 0;
  for (const character of sellerId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

// « Ines Ben Salah » donne « IB » ; un prénom seul donne ses deux premières lettres.
export function dressingMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "·";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toLocaleUpperCase();
}

// On n'affiche que le prénom : le nom complet d'un particulier n'a pas à s'étaler sur une vitrine.
export function dressingFirstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}
