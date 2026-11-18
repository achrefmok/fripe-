// Les types partagés des mannequins de la cabine : deux silhouettes (femme, homme), trois morphologies.
import type { Gender } from "../../engine";

export type { Gender };
export const MORPHS = ["mince", "standard", "large"] as const;
export type Morph = (typeof MORPHS)[number];

// Une zone du corps : la morphologie la fait varier (voir mannequin-morphology.ts).
export type Region =
  | "head"
  | "neck"
  | "shoulder"
  | "chest"
  | "waist"
  | "abdomen"
  | "hip"
  | "thigh"
  | "knee"
  | "calf"
  | "ankle"
  | "upperArm"
  | "forearm"
  | "hand"
  | "foot";

// Une section transversale du corps : un anneau autour de son centre. rx est la demi-largeur, rzF et rzB
// la profondeur vers l'avant et vers l'arrière (un buste n'est pas symétrique). n arrondit (2) ou carre
// (au-delà de 2) la section. bust, pecs et glutes ajoutent des volumes doux à l'avant ou à l'arrière.
export type Section = {
  at: [number, number, number];
  rx: number;
  rzF: number;
  rzB: number;
  region: Region;
  n?: number;
  bust?: number;
  pecs?: number;
  glutes?: number;
};

// Ce qu'on assemble : chaque partie est une surface continue qui suit ses sections.
export type PartName = "torso" | "head" | "armL" | "armR" | "legL" | "legR" | "footL" | "footR";
// « side » : l'axe de la largeur des anneaux ; « front » : l'axe de leur profondeur avant.
export type PartProfile = { name: PartName; sections: Section[]; side: [number, number, number]; front: [number, number, number] };

export type Profile = { gender: Gender; parts: PartProfile[] };

// Les repères du corps, en mètres (sol à y = 0, face vers +z) : les vêtements s'y accrochent.
export type Anchors = {
  height: number;
  neckBase: number;
  shoulder: number;
  shoulderHalfWidth: number;
  armpit: number;
  chest: number;
  waist: number;
  hip: number;
  crotch: number;
  knee: number;
  ankle: number;
  headTop: number;
  forehead: number;
  headHalfWidth: number;
  hand: { x: number; y: number; z: number };
  feet: { x: number; heel: number; toe: number; angle: number }[];
};
