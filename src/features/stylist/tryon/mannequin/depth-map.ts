// La surface avant du mannequin, vue de face : pour chaque point (x, y), la profondeur z du corps la plus
// proche du spectateur. Calculée une fois par silhouette, en rasterisant ses triangles (sans WebGL) ;
// les vêtements s'y enroulent (garments/garment-fitting.ts).
import type { BuiltMannequin } from "./build-mannequin";
import type { PartName } from "./mannequin-types";

export const STEP = 0.003;
export const HALF_WIDTH = 0.6;

export type DepthMap = { width: number; height: number; depth: Float32Array };

export function createDepthMap(mannequin: BuiltMannequin, parts: PartName[]): DepthMap {
  const width = Math.round((HALF_WIDTH * 2) / STEP);
  const height = Math.round((mannequin.anchors.height + 0.06) / STEP);
  const depth = new Float32Array(width * height).fill(Number.NaN);

  for (const part of mannequin.parts) {
    if (!parts.includes(part.name)) continue;
    const position = part.geometry.getAttribute("position").array as ArrayLike<number>;
    const index = part.geometry.getIndex()!.array as ArrayLike<number>;
    for (let face = 0; face < index.length; face += 3) {
      const a = index[face] * 3;
      const b = index[face + 1] * 3;
      const c = index[face + 2] * 3;
      // En cellules de la grille ; y vers le bas de la grille = vers le haut du corps.
      const ax = (position[a] + HALF_WIDTH) / STEP;
      const ay = position[a + 1] / STEP;
      const bx = (position[b] + HALF_WIDTH) / STEP;
      const by = position[b + 1] / STEP;
      const cx = (position[c] + HALF_WIDTH) / STEP;
      const cy = position[c + 1] / STEP;
      const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
      const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
      const maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;
          const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area;
          const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const z = w0 * position[a + 2] + w1 * position[b + 2] + w2 * position[c + 2];
          const cell = y * width + x;
          if (!(depth[cell] >= z)) depth[cell] = z;
        }
      }
    }
  }
  return { width, height, depth };
}

// La profondeur du corps en (x, y), ou NaN s'il n'y a pas de corps à cet endroit.
export function depthAt(map: DepthMap, x: number, y: number) {
  const column = Math.floor((x + HALF_WIDTH) / STEP);
  const row = Math.floor(y / STEP);
  if (column < 0 || column >= map.width || row < 0 || row >= map.height) return Number.NaN;
  return map.depth[row * map.width + column];
}

// La coupe horizontale du corps à la hauteur y, vue de face : des points (x, z) de gauche à droite.
export function rowProfile(map: DepthMap, y: number) {
  const row = Math.min(map.height - 1, Math.max(0, Math.floor(y / STEP)));
  const xs: number[] = [];
  const zs: number[] = [];
  for (let column = 0; column < map.width; column++) {
    xs.push(column * STEP + STEP / 2 - HALF_WIDTH);
    zs.push(map.depth[row * map.width + column]);
  }
  return { xs, zs };
}

// La demi-circonférence avant du corps à une hauteur : la longueur de tissu qu'il faut pour couvrir
// le devant, d'un côté à l'autre. Sert d'échelle pour les photos des pièces.
export function frontArc(map: DepthMap, y: number) {
  const { xs, zs } = rowProfile(map, y);
  const hits = zs.map((z, index) => (Number.isNaN(z) ? -1 : index)).filter((index) => index >= 0);
  if (!hits.length) return 0;
  const first = hits[0];
  const last = hits[hits.length - 1];
  let length = 0;
  let previous: [number, number] | null = null;
  for (let index = first; index <= last; index++) {
    // Entre deux parties (les jambes), le tissu passe tout droit.
    const z = Number.isNaN(zs[index]) ? null : zs[index];
    if (z === null) continue;
    if (previous) length += Math.hypot(xs[index] - previous[0], z - previous[1]);
    previous = [xs[index], z];
  }
  // Les flancs : la surface plonge vers l'arrière au bord de la silhouette.
  const depthOf = (index: number) => zs[index];
  length += Math.max(0, depthOf(first)) + Math.max(0, depthOf(last));
  return length;
}
