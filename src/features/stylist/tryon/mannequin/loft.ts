// Une surface lisse tendue sur une suite de sections : c'est ainsi que se dessinent le buste, les jambes,
// les bras, les pieds et la tête du mannequin. Les sections clés sont interpolées par des courbes
// (Catmull-Rom) ; on obtient une peau continue, sans les jointures de sphères et de cylindres.
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from "three";
import type { PartProfile, Section } from "./mannequin-types";

const FRONT = Math.PI / 2;

function bump(theta: number, center: number, width: number) {
  let delta = theta - center;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  return Math.exp(-((delta / width) ** 2));
}

// Catmull-Rom sur une valeur, aux mêmes paramètres que la courbe des centres.
function scalar(values: number[], t: number) {
  const span = values.length - 1;
  const position = Math.min(span - 1e-9, Math.max(0, t * span));
  const index = Math.floor(position);
  const local = position - index;
  const p0 = values[Math.max(0, index - 1)];
  const p1 = values[index];
  const p2 = values[Math.min(span, index + 1)];
  const p3 = values[Math.min(span, index + 2)];
  const t2 = local * local;
  const t3 = t2 * local;
  return 0.5 * (2 * p1 + (-p0 + p2) * local + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Le rayon d'une section dans une direction donnée : super-ellipse, profondeurs avant et arrière
// distinctes, volumes doux (poitrine, pectoraux, fessiers).
export function ringPoint(section: Omit<Section, "at" | "region">, theta: number) {
  const n = section.n ?? 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const exponent = 2 / n;
  const x = section.rx * Math.sign(c) * Math.abs(c) ** exponent;
  const z = (s >= 0 ? section.rzF : section.rzB) * Math.sign(s) * Math.abs(s) ** exponent;
  const volume =
    1 +
    (section.bust ?? 0) * (bump(theta, FRONT - 0.5, 0.36) + bump(theta, FRONT + 0.5, 0.36)) +
    (section.pecs ?? 0) * (bump(theta, FRONT - 0.55, 0.5) + bump(theta, FRONT + 0.55, 0.5)) +
    (section.glutes ?? 0) * (bump(theta, -FRONT - 0.48, 0.42) + bump(theta, -FRONT + 0.48, 0.42));
  return { x: x * volume, z: z * volume };
}

export function loft(part: PartProfile, options: { around?: number; steps?: number } = {}) {
  const around = options.around ?? 56;
  const steps = options.steps ?? 10;
  const keys = part.sections;
  const curve = new CatmullRomCurve3(
    keys.map((key) => new Vector3(...key.at)),
    false,
    "centripetal",
  );
  const field = (pick: (section: Section) => number) => keys.map(pick);
  const fields = {
    rx: field((key) => key.rx),
    rzF: field((key) => key.rzF),
    rzB: field((key) => key.rzB),
    n: field((key) => key.n ?? 2),
    bust: field((key) => key.bust ?? 0),
    pecs: field((key) => key.pecs ?? 0),
    glutes: field((key) => key.glutes ?? 0),
  };

  const sideHint = new Vector3(...part.side);
  const frontHint = new Vector3(...part.front);
  const rings = (keys.length - 1) * steps + 1;
  const positions: number[] = [];
  const indices: number[] = [];
  const center = new Vector3();
  const tangent = new Vector3();
  const side = new Vector3();
  const front = new Vector3();

  for (let ring = 0; ring < rings; ring++) {
    const t = ring / (rings - 1);
    curve.getPoint(t, center);
    curve.getTangent(t, tangent);
    side.copy(sideHint).addScaledVector(tangent, -sideHint.dot(tangent)).normalize();
    front.crossVectors(tangent, side).normalize();
    if (front.dot(frontHint) < 0) front.negate();
    const section = {
      rx: Math.max(1e-4, scalar(fields.rx, t)),
      rzF: Math.max(1e-4, scalar(fields.rzF, t)),
      rzB: Math.max(1e-4, scalar(fields.rzB, t)),
      n: Math.max(1.6, scalar(fields.n, t)),
      bust: Math.max(0, scalar(fields.bust, t)),
      pecs: Math.max(0, scalar(fields.pecs, t)),
      glutes: Math.max(0, scalar(fields.glutes, t)),
    };
    for (let step = 0; step < around; step++) {
      const { x, z } = ringPoint(section, (step / around) * Math.PI * 2);
      positions.push(center.x + side.x * x + front.x * z, center.y + side.y * x + front.y * z, center.z + side.z * x + front.z * z);
    }
  }

  for (let ring = 0; ring < rings - 1; ring++) {
    for (let step = 0; step < around; step++) {
      const a = ring * around + step;
      const b = ring * around + ((step + 1) % around);
      const c = a + around;
      const d = b + around;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Les deux bouts se ferment sur un pôle, légèrement bombé.
  for (const [ring, direction] of [
    [0, -1],
    [rings - 1, 1],
  ] as const) {
    const t = ring / (rings - 1);
    curve.getPoint(t, center);
    curve.getTangent(t, tangent);
    const radius = Math.min(scalar(fields.rx, t), scalar(fields.rzF, t), scalar(fields.rzB, t));
    const pole = center.clone().addScaledVector(tangent, direction * radius * 0.6);
    const index = positions.length / 3;
    positions.push(pole.x, pole.y, pole.z);
    for (let step = 0; step < around; step++) {
      const a = ring * around + step;
      const b = ring * around + ((step + 1) % around);
      if (direction < 0) indices.push(index, a, b);
      else indices.push(index, b, a);
    }
  }

  // Les faces doivent regarder vers l'extérieur : on vérifie sur un anneau du milieu, on retourne sinon.
  const mid = Math.floor(rings / 2) * around;
  const at = (index: number) => new Vector3(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
  const a = at(mid);
  const normal = at(mid + around).sub(a).cross(at(mid + 1).sub(a));
  curve.getPoint(Math.floor(rings / 2) / (rings - 1), center);
  if (normal.dot(a.clone().sub(center)) < 0) {
    for (let index = 0; index < indices.length; index += 3) [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
