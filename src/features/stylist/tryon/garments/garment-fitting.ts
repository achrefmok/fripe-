// La pièce posée sur le mannequin. La photo n'est jamais étirée : elle garde ses proportions et son
// échelle (une seule pour toute la pièce), et s'enroule sur le devant du corps comme un tissu, en
// conservant les longueurs. Un short reste court, une jupe garde sa forme, un haut long descend sous
// la taille. L'échelle vient de la silhouette standard : sur une silhouette large, la même pièce
// couvre moins le corps, sur une mince, davantage. C'est un aperçu, pas une mesure de taille.
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { BuiltMannequin } from "../mannequin/build-mannequin";
import { type DepthMap, frontArc, rowProfile } from "../mannequin/depth-map";
import type { Anchors } from "../mannequin/mannequin-types";
import type { FitRule } from "./garment-config";
import { bandWidth, contentTop, type GarmentShape, toeSide } from "./garment-measure";

export type Reference = { chest: number; bottom: number; head: number; foot: number };
export type Adjust = { scale: number; dy: number };
export type FitMaps = { full: DepthMap; torso: DepthMap };

const ROWS = 90;
const COLUMNS = 64;

export function bottomLine(anchors: Anchors) {
  return anchors.waist + (anchors.hip - anchors.waist) * 0.3;
}

// Les mesures de la silhouette standard, qui fixent l'échelle des photos.
export function referenceOf(mannequin: BuiltMannequin, torso: DepthMap): Reference {
  const { anchors } = mannequin;
  const foot = anchors.feet[0];
  return {
    chest: frontArc(torso, anchors.chest),
    bottom: frontArc(torso, bottomLine(anchors)),
    head: frontArc(torso, anchors.forehead - 0.02),
    foot: foot.toe - foot.heel,
  };
}

// Mètres par pixel de la photo : une seule échelle, pour la largeur comme pour la longueur.
export function garmentScale(rule: FitRule, shape: GarmentShape, reference: Reference) {
  if (rule.target === "fixed") return (rule.fixedWidth ?? 0.2) / shape.width;
  if (rule.target === "foot") return (reference.foot * rule.ease) / shape.width;
  const { width } = bandWidth(shape, rule.band);
  const target = rule.target === "chest" ? reference.chest : rule.target === "waist" ? reference.bottom : reference.head;
  return (target * rule.ease) / Math.max(1, width);
}

// Le haut de la photo, en mètres : sous le cou pour un haut, à la taille pour un bas.
export function garmentTop(rule: FitRule, anchors: Anchors, heightMeters: number) {
  switch (rule.anchor) {
    case "neck":
      return anchors.neckBase + (rule.layer > 0.02 ? 0.018 : 0.004);
    case "waist":
      return bottomLine(anchors);
    case "head":
      return anchors.forehead + heightMeters * 0.86;
    case "hand":
      return anchors.hand.y + 0.08;
    default:
      return heightMeters;
  }
}

type Chain = { points: [number, number][]; lengths: number[] };

function chain(points: [number, number][]): Chain {
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
  }
  return { points, lengths };
}

function along({ points, lengths }: Chain, distance: number): [number, number] {
  if (distance <= 0) return points[0];
  const total = lengths[lengths.length - 1];
  if (distance >= total) return points[points.length - 1];
  let low = 0;
  let high = lengths.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (lengths[middle] <= distance) low = middle;
    else high = middle;
  }
  const t = (distance - lengths[low]) / Math.max(1e-9, lengths[high] - lengths[low]);
  return [points[low][0] + (points[high][0] - points[low][0]) * t, points[low][1] + (points[high][1] - points[low][1]) * t];
}

// La coupe du corps à une hauteur, comblée entre les parties (jambes), décalée de l'épaisseur du
// vêtement, puis prolongée vers l'arrière sur les flancs. Deux chaînes, du centre vers chaque côté.
function rowChains(map: DepthMap, y: number, layer: number, flare = 1): { right: Chain; left: Chain } | null {
  const { xs, zs } = rowProfile(map, y);
  const hits = zs.flatMap((z, index) => (Number.isNaN(z) ? [] : [index]));
  if (hits.length < 3) return null;
  const first = hits[0];
  const last = hits[hits.length - 1];
  const filled: [number, number][] = [];
  let previous = first;
  for (let index = first; index <= last; index++) {
    if (!Number.isNaN(zs[index])) {
      previous = index;
      filled.push([xs[index] * flare, zs[index] * flare]);
      continue;
    }
    const next = hits.find((hit) => hit > index)!;
    const t = (index - previous) / (next - previous);
    filled.push([xs[index] * flare, (zs[previous] + (zs[next] - zs[previous]) * t) * flare]);
  }

  // Lissage léger, puis décalage le long de la normale : le tissu passe au-dessus de la peau.
  const smooth = filled.map((point, index) => {
    const a = filled[Math.max(0, index - 2)];
    const b = filled[Math.min(filled.length - 1, index + 2)];
    return [point[0], (a[1] + point[1] * 2 + b[1]) / 4] as [number, number];
  });
  const offset = smooth.map((point, index) => {
    const a = smooth[Math.max(0, index - 1)];
    const b = smooth[Math.min(smooth.length - 1, index + 1)];
    const tx = b[0] - a[0];
    const tz = b[1] - a[1];
    const length = Math.hypot(tx, tz) || 1;
    return [point[0] - (tz / length) * layer, point[1] + (tx / length) * layer] as [number, number];
  });

  const center = offset.reduce((best, point, index) => (Math.abs(point[0]) < Math.abs(offset[best][0]) ? index : best), 0);
  const side = (from: number, to: number) => {
    const points = from <= to ? offset.slice(from, to + 1) : offset.slice(to, from + 1).reverse();
    const [x, z] = points[points.length - 1];
    // Au bord de la silhouette, le tissu tourne vers l'arrière du corps.
    for (let step = 1; step <= 20; step++) points.push([x + Math.sign(x) * layer * 0.5, z - step * 0.012]);
    return chain(points);
  };
  return { right: side(center, offset.length - 1), left: side(center, 0) };
}

// La pièce en coque autour du corps : une grille dont chaque colonne de la photo suit la coupe du corps.
export function shellGeometry(input: {
  mannequin: BuiltMannequin;
  maps: FitMaps;
  rule: FitRule;
  shape: GarmentShape;
  reference: Reference;
  adjust: Adjust;
}) {
  const { mannequin, maps, rule, shape, reference, adjust } = input;
  const { anchors } = mannequin;
  const scale = garmentScale(rule, shape, reference) * adjust.scale;
  const band = bandWidth(shape, rule.band);
  // Le cintre éventuel est laissé de côté : la pièce commence à sa première vraie rangée.
  const startRow = contentTop(shape, band.width);
  const widthMeters = shape.width * scale;
  const heightMeters = (shape.height - startRow) * scale;
  const top = garmentTop(rule, anchors, heightMeters) + adjust.dy;
  const center = band.center;
  const hipArc = frontArc(maps.torso, anchors.hip) / 2;

  const positions = new Float32Array(ROWS * COLUMNS * 3);
  const uvs = new Float32Array(ROWS * COLUMNS * 2);
  let fallback: { right: Chain; left: Chain } | null = null;
  const pending: number[] = [];

  for (let row = 0; row < ROWS; row++) {
    const v = row / (ROWS - 1);
    const y = top - v * heightMeters;
    const pixel = startRow + v * (shape.height - startRow);
    const pixelRow = shape.rows[Math.min(shape.height - 1, Math.floor(pixel))];
    let chains: { right: Chain; left: Chain } | null;
    if (rule.wrap === "hang" && y < anchors.hip) {
      // Sous les hanches, une jupe ou une robe tombe : elle suit la coupe des hanches, évasée juste
      // assez pour contenir la largeur de la photo à cette hauteur.
      const reach = pixelRow.coreFirst >= 0 ? Math.max(center - pixelRow.coreFirst, pixelRow.coreLast - center) * scale : 0;
      const flare = Math.max(1, reach / Math.max(0.05, hipArc));
      chains = rowChains(maps.torso, anchors.hip, rule.layer, flare);
    } else {
      const map = rule.anchor === "neck" && y >= anchors.armpit ? maps.full : maps.torso;
      chains = rowChains(map, y, rule.layer);
    }
    if (chains) fallback = chains;
    else if (!fallback) pending.push(row);
    const use = chains ?? fallback;

    for (let column = 0; column < COLUMNS; column++) {
      const u = column / (COLUMNS - 1);
      const fabric = (u * shape.width - center) * scale;
      const index = row * COLUMNS + column;
      let point: [number, number] = [fabric, 0.15];
      if (use) point = fabric >= 0 ? along(use.right, fabric) : along(use.left, -fabric);
      positions.set([point[0], y, point[1]], index * 3);
      uvs.set([u, 1 - pixel / shape.height], index * 2);
    }
  }
  // Les rangées au-dessus du corps (col, capuche) reprennent la première coupe trouvée.
  if (pending.length && fallback) {
    const firstValid = pending[pending.length - 1] + 1;
    for (const row of pending) {
      for (let column = 0; column < COLUMNS; column++) {
        const source = (firstValid * COLUMNS + column) * 3;
        const target = (row * COLUMNS + column) * 3;
        positions[target] = positions[source];
        positions[target + 2] = positions[source + 2];
      }
    }
  }

  // Lissage vertical : pas de cassure entre deux rangées (passage des épaules aux bras, par exemple).
  for (let pass = 0; pass < 2; pass++) {
    const copy = positions.slice();
    for (let row = 1; row < ROWS - 1; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        for (const axis of [0, 2]) {
          const at = (r: number) => copy[(r * COLUMNS + column) * 3 + axis];
          positions[(row * COLUMNS + column) * 3 + axis] = (at(row - 1) + at(row) * 2 + at(row + 1)) / 4;
        }
      }
    }
  }

  const indices: number[] = [];
  for (let row = 0; row < ROWS - 1; row++) {
    for (let column = 0; column < COLUMNS - 1; column++) {
      const a = row * COLUMNS + column;
      const b = a + 1;
      const c = a + COLUMNS;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, widthMeters, heightMeters, top };
}

// Les chaussures : chaque pied du mannequin, légèrement agrandi, reçoit la photo de profil projetée de
// côté (la pointe de la photo vers la pointe du pied). La hauteur suit l'échelle de la photo.
export function shoeGeometries(input: { mannequin: BuiltMannequin; shape: GarmentShape; rule: FitRule; reference: Reference; adjust: Adjust }) {
  const { mannequin, shape, rule, reference, adjust } = input;
  const scale = garmentScale(rule, shape, reference) * adjust.scale;
  const heightMeters = shape.height * scale;
  const toeFirst = toeSide(shape) === "left";
  return (["footL", "footR"] as const).map((name, side) => {
    const source = mannequin.parts.find((part) => part.name === name)!.geometry;
    const geometry = source.clone();
    const foot = mannequin.anchors.feet[side];
    const angle = (foot.angle * Math.PI) / 180;
    const forward = new Vector3(Math.sin(angle), 0, Math.cos(angle));
    const heel = new Vector3(foot.x + foot.heel * Math.sin(angle), 0, foot.heel * Math.cos(angle));
    const length = (foot.toe - foot.heel) * rule.ease * adjust.scale;
    const position = geometry.getAttribute("position");
    const uv = new Float32Array(position.count * 2);
    const point = new Vector3();
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index);
      // Un peu plus grand que le pied, posé au sol.
      const local = point.clone().sub(heel);
      const along = local.dot(forward);
      const across = local.clone().addScaledVector(forward, -along);
      const grown = heel.clone().addScaledVector(forward, along * 1.08 - 0.008).addScaledVector(across, 1.12);
      position.setXYZ(index, grown.x, Math.max(0, point.y * 1.14 + adjust.dy * 0.2), grown.z);
      const u = Math.min(1, Math.max(0, (along * 1.08 + 0.004) / length));
      uv[index * 2] = toeFirst ? 1 - u : u;
      uv[index * 2 + 1] = Math.min(1, point.y * 1.14 / heightMeters);
    }
    geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    geometry.computeVertexNormals();
    return geometry;
  });
}

// Le sac ou l'accessoire, tenu à la main : une image plane, à ses proportions.
export function cardPlacement(input: { mannequin: BuiltMannequin; shape: GarmentShape; rule: FitRule; reference: Reference; adjust: Adjust; side: 1 | -1 }) {
  const { mannequin, shape, rule, reference, adjust, side } = input;
  const scale = garmentScale(rule, shape, reference) * adjust.scale;
  const width = shape.width * scale;
  const height = shape.height * scale;
  const hand = mannequin.anchors.hand;
  return {
    width,
    height,
    x: side * (hand.x + 0.02 + width * 0.18),
    y: garmentTop(rule, mannequin.anchors, height) - height / 2 + adjust.dy,
    z: hand.z + 0.07,
    rotateY: -side * 0.22,
  };
}
