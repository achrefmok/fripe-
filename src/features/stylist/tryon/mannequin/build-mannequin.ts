// Assemble un mannequin à partir de sa définition (femme ou homme) et d'une morphologie : chaque
// section est remodelée, les bras et les jambes s'écartent quand le corps s'élargit, puis chaque
// partie devient une surface lisse (loft.ts). Rend aussi les repères où s'accrochent les vêtements.
import type { BufferGeometry } from "three";
import { loft } from "./loft";
import { limbSpread, shapeSection } from "./mannequin-morphology";
import type { Anchors, Gender, Morph, PartName, PartProfile, Section } from "./mannequin-types";

export type BodyDefinition = {
  gender: Gender;
  torso: Section[];
  head: Section[];
  arm: Section[];
  leg: Section[];
  foot: Section[];
  // L'ouverture des pieds vers l'extérieur, en degrés.
  footAngle: number;
  levels: { shoulder: number; armpit: number; chest: number; waist: number; hip: number; crotch: number; knee: number; ankle: number; forehead: number };
};

export type BuiltPart = { name: PartName; geometry: BufferGeometry };
export type BuiltMannequin = { gender: Gender; morph: Morph; parts: BuiltPart[]; anchors: Anchors };

const mirror = (section: Section): Section => ({ ...section, at: [-section.at[0], section.at[1], section.at[2]] });
const shift = (section: Section, dx: number): Section => ({ ...section, at: [section.at[0] + dx, section.at[1], section.at[2]] });

// Les sections du mannequin, déjà remodelées pour la morphologie : partagées par la géométrie et les tests.
export function bodyProfile(definition: BodyDefinition, morph: Morph): { parts: PartProfile[]; feet: Anchors["feet"] } {
  const { gender } = definition;
  const shape = (section: Section) => shapeSection(section, gender, morph);
  const widest = (sections: Section[], region: Section["region"]) => Math.max(...sections.filter((section) => section.region === region).map((section) => section.rx));
  const spread = limbSpread(gender, morph, {
    shoulder: widest(definition.torso, "shoulder"),
    hip: widest(definition.torso, "hip"),
    thigh: widest(definition.leg, "thigh"),
  });

  const torso = definition.torso.map(shape);
  const head = definition.head.map(shape);
  // Le haut du bras suit l'épaule ; l'avant-bras s'écarte assez pour ne pas entrer dans les hanches.
  const arm = definition.arm.map((section) => {
    const lower = section.region === "forearm" || section.region === "hand";
    return shift(shape(section), lower ? spread.armLow : spread.arm);
  });
  const leg = definition.leg.map((section) => shift(shape(section), spread.leg));

  const angle = (definition.footAngle * Math.PI) / 180;
  const ankleX = definition.foot[0].at[0] + spread.leg;
  const foot = (side: 1 | -1) =>
    definition.foot.map((section) => {
      const shaped = shape(section);
      const [, y, z] = shaped.at;
      return { ...shaped, at: [side * (ankleX + z * Math.sin(angle)), y, z * Math.cos(angle)] as [number, number, number] };
    });

  const footSide = (side: 1 | -1): [number, number, number] => [Math.cos(angle), 0, -side * Math.sin(angle)];
  const parts: PartProfile[] = [
    { name: "torso", sections: torso, side: [1, 0, 0], front: [0, 0, 1] },
    { name: "head", sections: head, side: [1, 0, 0], front: [0, 0, 1] },
    { name: "armL", sections: arm, side: [1, 0, 0], front: [0, 0, 1] },
    { name: "armR", sections: arm.map(mirror), side: [1, 0, 0], front: [0, 0, 1] },
    { name: "legL", sections: leg, side: [1, 0, 0], front: [0, 0, 1] },
    { name: "legR", sections: leg.map(mirror), side: [1, 0, 0], front: [0, 0, 1] },
    { name: "footL", sections: foot(1), side: footSide(1), front: [0, 1, 0] },
    { name: "footR", sections: foot(-1), side: footSide(-1), front: [0, 1, 0] },
  ];
  const heel = definition.foot[0].at[2];
  const toe = definition.foot[definition.foot.length - 1].at[2];
  const feet = ([1, -1] as const).map((side) => ({ x: side * ankleX, heel, toe, angle: side * definition.footAngle }));
  return { parts, feet };
}

export function buildMannequin(definition: BodyDefinition, morph: Morph): BuiltMannequin {
  const { parts: profile, feet } = bodyProfile(definition, morph);
  const parts = profile.map((part) => ({
    name: part.name,
    geometry: loft(part, part.name === "torso" || part.name === "head" ? { around: 72, steps: 10 } : { around: 48, steps: 8 }),
  }));

  // Le mannequin repose sur le sol : le point le plus bas des pieds est à y = 0.
  let floor = Infinity;
  let top = -Infinity;
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    floor = Math.min(floor, part.geometry.boundingBox!.min.y);
    if (part.name === "head") top = part.geometry.boundingBox!.max.y;
  }
  for (const part of parts) {
    part.geometry.translate(0, -floor, 0);
    part.geometry.computeBoundingBox();
  }

  const levels = Object.fromEntries(Object.entries(definition.levels).map(([key, value]) => [key, value - floor])) as BodyDefinition["levels"];
  const arm = profile.find((part) => part.name === "armL")!.sections;
  const deltoid = arm[1];
  const hand = arm[Math.min(arm.length - 3, 9)];
  const head = profile.find((part) => part.name === "head")!.sections;

  const anchors: Anchors = {
    ...levels,
    height: top - floor,
    neckBase: definition.torso.find((section) => section.region === "neck")!.at[1] - floor,
    shoulderHalfWidth: deltoid.at[0] + deltoid.rx,
    headTop: top - floor,
    headHalfWidth: Math.max(...head.map((section) => section.rx)),
    hand: { x: hand.at[0], y: hand.at[1] - floor, z: hand.at[2] },
    feet,
  };
  return { gender: definition.gender, morph, parts, anchors };
}
