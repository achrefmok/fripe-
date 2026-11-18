// Les trois morphologies (mince, standard, large) modifient chaque zone du corps séparément : une
// silhouette large prend surtout à la taille, au ventre, aux hanches et aux cuisses, peu aux épaules.
// Ce sont des silhouettes indicatives, jamais une mesure de taille.
import type { Gender, Morph, Region, Section } from "./mannequin-types";

type Factor = { w: number; dF: number; dB: number };
type Table = Partial<Record<Region, Factor>> & { volume?: number };

const f = (w: number, dF = w, dB = dF): Factor => ({ w, dF, dB });

const FACTORS: Record<Gender, Record<Morph, Table>> = {
  femme: {
    mince: {
      neck: f(0.94),
      shoulder: f(0.96, 0.93),
      chest: f(0.93, 0.9, 0.93),
      waist: f(0.88, 0.85, 0.9),
      abdomen: f(0.9, 0.85, 0.9),
      hip: f(0.92, 0.9, 0.9),
      thigh: f(0.86),
      knee: f(0.92),
      calf: f(0.88),
      ankle: f(0.95),
      upperArm: f(0.86),
      forearm: f(0.9),
      volume: 0.72,
    },
    standard: {},
    large: {
      neck: f(1.1),
      shoulder: f(1.06, 1.1),
      chest: f(1.12, 1.18, 1.12),
      waist: f(1.3, 1.38, 1.2),
      abdomen: f(1.26, 1.45, 1.2),
      hip: f(1.16, 1.14, 1.18),
      thigh: f(1.24, 1.22),
      knee: f(1.12),
      calf: f(1.15),
      ankle: f(1.06),
      upperArm: f(1.25),
      forearm: f(1.15),
      hand: f(1.05),
      foot: f(1.04),
      volume: 1.3,
    },
  },
  homme: {
    mince: {
      neck: f(0.92),
      shoulder: f(0.94, 0.92),
      chest: f(0.9, 0.88, 0.9),
      waist: f(0.86, 0.84, 0.88),
      abdomen: f(0.86, 0.82, 0.88),
      hip: f(0.92, 0.9, 0.9),
      thigh: f(0.86),
      knee: f(0.92),
      calf: f(0.88),
      upperArm: f(0.85),
      forearm: f(0.88),
      volume: 0.7,
    },
    standard: {},
    large: {
      neck: f(1.15),
      shoulder: f(1.08, 1.12, 1.1),
      chest: f(1.14, 1.2, 1.12),
      waist: f(1.32, 1.5, 1.18),
      abdomen: f(1.3, 1.6, 1.18),
      hip: f(1.14, 1.12, 1.14),
      thigh: f(1.2),
      knee: f(1.1),
      calf: f(1.14),
      ankle: f(1.04),
      upperArm: f(1.22),
      forearm: f(1.14),
      hand: f(1.04),
      foot: f(1.03),
      volume: 1.4,
    },
  },
};

export function factor(gender: Gender, morph: Morph, region: Region): Factor {
  return FACTORS[gender][morph][region] ?? f(1);
}

export function shapeSection(section: Section, gender: Gender, morph: Morph): Section {
  const scale = factor(gender, morph, section.region);
  const volume = FACTORS[gender][morph].volume ?? 1;
  return {
    ...section,
    rx: section.rx * scale.w,
    rzF: section.rzF * scale.dF,
    rzB: section.rzB * scale.dB,
    bust: section.bust === undefined ? undefined : section.bust * volume,
    pecs: section.pecs === undefined ? undefined : section.pecs * volume,
    glutes: section.glutes === undefined ? undefined : section.glutes * Math.sqrt(volume),
  };
}

// De combien s'écartent les bras et les jambes quand le buste, les hanches et les cuisses s'élargissent.
export function limbSpread(gender: Gender, morph: Morph, base: { shoulder: number; hip: number; thigh: number }) {
  const grow = (region: Region, width: number) => width * (factor(gender, morph, region).w - 1);
  return {
    arm: grow("shoulder", base.shoulder),
    armLow: Math.max(grow("shoulder", base.shoulder), grow("hip", base.hip) + grow("waist", base.hip) * 0.3),
    leg: grow("thigh", base.thigh) * 0.55 + grow("hip", base.hip) * 0.25,
  };
}
