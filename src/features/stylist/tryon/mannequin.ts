// La cabine 3D, côté données : les mannequins (mis en cache par silhouette), les pièces détourées
// et leur mise en place. La scène (scene/fitting-scene.ts) ne fait qu'afficher ce qui est construit ici.
import { CanvasTexture, DoubleSide, Mesh, MeshStandardMaterial, type Object3D, PlaneGeometry, SRGBColorSpace } from "three";
import type { Slot, StyleItem } from "../engine";
import { FIT_RULES, GARMENT_KINDS, type GarmentKind, kindSuits, ruleKey } from "./garments/garment-config";
import { type Adjust, cardPlacement, type FitMaps, type Reference, referenceOf, shellGeometry, shoeGeometries } from "./garments/garment-fitting";
import { LAYER_ORDER } from "./garments/garment-layers";
import { bottomFromShape, type GarmentShape, keepCore, measureAlpha } from "./garments/garment-measure";
import { type BuiltMannequin, buildMannequin } from "./mannequin/build-mannequin";
import { createDepthMap } from "./mannequin/depth-map";
import { FEMALE } from "./mannequin/female-mannequin";
import { MALE } from "./mannequin/male-mannequin";
import type { Gender, Morph } from "./mannequin/mannequin-types";
import { createFittingScene } from "./scene/fitting-scene";

export type Body = { mannequin: BuiltMannequin; maps: FitMaps; reference: Reference };
export type PreparedGarment = { slot: Slot; item: StyleItem; kind: GarmentKind | null; canvas: HTMLCanvasElement; shape: GarmentShape; texture: CanvasTexture };

const DEFINITIONS = { femme: FEMALE, homme: MALE } as const;
const TORSO_PARTS = ["torso", "head", "legL", "legR", "footL", "footR"] as const;
const bodies = new Map<string, Body>();

function mapsOf(mannequin: BuiltMannequin): FitMaps {
  return {
    full: createDepthMap(mannequin, ["torso", "head", "armL", "armR", "legL", "legR", "footL", "footR"]),
    torso: createDepthMap(mannequin, [...TORSO_PARTS]),
  };
}

// Le mannequin d'une silhouette, avec ses cartes de profondeur et l'échelle de référence (standard).
export function getBody(gender: Gender, morph: Morph): Body {
  const key = `${gender}:${morph}`;
  const cached = bodies.get(key);
  if (cached) return cached;
  const mannequin = buildMannequin(DEFINITIONS[gender], morph);
  const maps = mapsOf(mannequin);
  const standard = morph === "standard" ? { mannequin, maps } : getBody(gender, "standard");
  const body = { mannequin, maps, reference: referenceOf(standard.mannequin, standard.maps.torso) };
  bodies.set(key, body);
  return body;
}

export function itemKind(item: Pick<StyleItem, "kind">): GarmentKind | null {
  return GARMENT_KINDS.includes(item.kind as GarmentKind) ? (item.kind as GarmentKind) : null;
}

// Une bordure transparente autour de la photo : les bords de la texture ne bavent pas.
function padded(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width + 4;
  canvas.height = source.height + 4;
  canvas.getContext("2d")!.drawImage(source, 2, 2);
  return canvas;
}

export function prepareGarment(slot: Slot, item: StyleItem, cutout: HTMLCanvasElement): PreparedGarment {
  const canvas = padded(cutout);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const shape = measureAlpha(image.data, canvas.width, canvas.height);
  let kind = itemKind(item);
  // Jupe ou short non précisé : la forme de la photo tranche si elle est nette, sinon rien n'est forcé.
  if (!kind && slot === "bottom") kind = bottomFromShape(shape);
  // Hauts, vestes, robes : les manches détachées du corps sur la photo ne sont pas posées.
  if (FIT_RULES[ruleKey(kind, slot)].anchor === "neck") {
    keepCore(image.data, shape);
    context.putImageData(image, 0, 0);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { slot, item, kind, canvas, shape, texture };
}

// Ce que le mannequin choisi porte, et ce qu'il ne peut pas porter (une robe sur le mannequin homme).
export function wornBy(gender: Gender, garments: PreparedGarment[]) {
  return {
    worn: garments.filter((garment) => kindSuits(garment.kind, gender)),
    skipped: garments.filter((garment) => !kindSuits(garment.kind, gender)),
  };
}

function material(garment: PreparedGarment) {
  return new MeshStandardMaterial({ map: garment.texture, alphaTest: 0.45, side: DoubleSide, roughness: 0.9, metalness: 0 });
}

// Les maillages des pièces portées, dans l'ordre où l'on s'habille.
export function dressBody(body: Body, garments: PreparedGarment[], adjusts: Partial<Record<Slot, Adjust>>): Object3D[] {
  const objects: Object3D[] = [];
  const ordered = [...garments].sort((a, b) => LAYER_ORDER.indexOf(a.slot) - LAYER_ORDER.indexOf(b.slot));
  for (const [order, garment] of ordered.entries()) {
    const rule = FIT_RULES[ruleKey(garment.kind, garment.slot)];
    const adjust = adjusts[garment.slot] ?? { scale: 1, dy: 0 };
    const common = { mannequin: body.mannequin, shape: garment.shape, rule, reference: body.reference, adjust };
    // Une texture partagée par plusieurs maillages ne doit être libérée qu'une fois : chaque maillage a la sienne.
    const texture = garment.texture.clone();
    const own = { ...garment, texture };
    if (rule.wrap === "foot") {
      for (const geometry of shoeGeometries(common)) {
        const mesh = new Mesh(geometry, material({ ...own, texture: texture.clone() }));
        mesh.renderOrder = order;
        mesh.userData.slot = garment.slot;
        objects.push(mesh);
      }
      texture.dispose();
      continue;
    }
    if (rule.wrap === "card") {
      const place = cardPlacement({ ...common, side: garment.kind === "bag" ? 1 : -1 });
      const mesh = new Mesh(new PlaneGeometry(place.width, place.height), material(own));
      mesh.position.set(place.x, place.y, place.z);
      mesh.rotation.y = place.rotateY;
      mesh.renderOrder = order;
      mesh.userData.slot = garment.slot;
      objects.push(mesh);
      continue;
    }
    const { geometry } = shellGeometry({ ...common, maps: body.maps });
    const mesh = new Mesh(geometry, material(own));
    mesh.receiveShadow = true;
    mesh.renderOrder = order;
    mesh.userData.slot = garment.slot;
    objects.push(mesh);
  }
  return objects;
}

// Les vignettes du choix homme/femme : le mannequin standard, rendu une fois puis libéré.
let thumbnails: Promise<Record<Gender, string>> | null = null;
export function mannequinThumbnails() {
  thumbnails ??= (async () => {
    const result = {} as Record<Gender, string>;
    for (const gender of ["femme", "homme"] as const) {
      const canvas = document.createElement("canvas");
      const scene = createFittingScene(canvas, { lowPower: true });
      try {
        scene.setBody(getBody(gender, "standard").mannequin);
        scene.resize(240, 320);
        await scene.snapshot();
        result[gender] = canvas.toDataURL("image/png");
      } finally {
        scene.dispose();
      }
    }
    return result;
  })();
  thumbnails.catch(() => {
    thumbnails = null;
  });
  return thumbnails;
}
