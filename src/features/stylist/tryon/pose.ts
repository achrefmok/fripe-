// Essayage virtuel, entièrement dans le navigateur : la photo ne quitte jamais l'appareil.
// MediaPipe (code Apache 2.0) avec deux modèles sous licence Apache 2.0 : BlazePose pour la pose et la
// silhouette, MagicTouch pour détourer les photos de pièces (segment.ts). Servis par le site depuis
// /mediapipe (scripts/mediapipe-assets.mjs) et chargés seulement à l'ouverture de l'essayage.
import type { Slot } from "../engine";

type Point = { x: number; y: number; visibility?: number };
export type Pose = Point[];
export type BodyMask = { data: Float32Array; width: number; height: number };

type Mask = { width: number; height: number; getAsFloat32Array: () => Float32Array; close: () => void };
type Landmarker = { detect: (image: TexImageSource) => { landmarks: Point[][]; segmentationMasks?: Mask[] }; close: () => void };

// Le moteur WebAssembly, partagé par la pose et le détourage.
let fileset: Promise<unknown> | null = null;
export async function visionFileset() {
  fileset ??= import("@mediapipe/tasks-vision").then(({ FilesetResolver }) => FilesetResolver.forVisionTasks("/mediapipe/wasm"));
  fileset.catch(() => {
    fileset = null;
  });
  return fileset;
}

let landmarker: Promise<Landmarker> | null = null;
async function create(delegate: "GPU" | "CPU") {
  const [{ PoseLandmarker }, files] = await Promise.all([import("@mediapipe/tasks-vision"), visionFileset()]);
  return PoseLandmarker.createFromOptions(files as never, {
    baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate },
    runningMode: "IMAGE",
    numPoses: 1,
    // La silhouette de la personne : les vêtements sont découpés selon elle.
    outputSegmentationMasks: true,
  }) as Promise<Landmarker>;
}

// Le processeur graphique d'abord ; s'il n'est pas disponible, le processeur central.
function getLandmarker() {
  landmarker ??= create("GPU").catch(() => create("CPU"));
  landmarker.catch(() => {
    landmarker = null;
  });
  return landmarker;
}

export async function detectPose(image: TexImageSource): Promise<{ pose: Pose | null; mask: BodyMask | null }> {
  const model = await getLandmarker();
  const result = model.detect(image);
  const raw = result.segmentationMasks?.[0];
  // Le masque n'est valable que jusqu'au prochain appel : on en garde une copie.
  const mask = raw ? { data: raw.getAsFloat32Array().slice(), width: raw.width, height: raw.height } : null;
  raw?.close();
  return { pose: result.landmarks[0] ?? null, mask };
}

// Où poser chaque pièce, en fractions de la photo (repli sans silhouette, et tests unitaires).
export type Placement = { left: number; top: number; width: number; rotate: number };

const L = { shoulderL: 11, shoulderR: 12, wristL: 15, wristR: 16, hipL: 23, hipR: 24, ankleL: 27, ankleR: 28 } as const;

export function placeGarments(pose: Pose | null, aspect: number): Record<Slot, Placement> {
  const fallback: Record<Slot, Placement> = {
    top: { left: 0.3, top: 0.18, width: 0.4, rotate: 0 },
    bottom: { left: 0.33, top: 0.48, width: 0.34, rotate: 0 },
    shoes: { left: 0.36, top: 0.86, width: 0.28, rotate: 0 },
    accessory: { left: 0.68, top: 0.42, width: 0.18, rotate: 0 },
  };
  if (!pose) return fallback;

  const seen = (index: number) => (pose[index]?.visibility ?? 1) > 0.4;
  const mid = (a: number, b: number) => ({ x: (pose[a].x + pose[b].x) / 2, y: (pose[a].y + pose[b].y) / 2 });
  const distance = (a: number, b: number) => Math.hypot(pose[a].x - pose[b].x, (pose[a].y - pose[b].y) * aspect);
  const angle = (a: number, b: number) => {
    const degrees = (Math.atan2((pose[b].y - pose[a].y) * aspect, pose[b].x - pose[a].x) * 180) / Math.PI;
    return Math.abs(degrees) > 90 ? degrees - Math.sign(degrees) * 180 : degrees;
  };

  const placements = { ...fallback };
  if (seen(L.shoulderL) && seen(L.shoulderR)) {
    const shoulders = mid(L.shoulderL, L.shoulderR);
    const span = distance(L.shoulderL, L.shoulderR);
    const width = span * 1.9;
    placements.top = { left: shoulders.x - width / 2, top: shoulders.y - (span * 0.3) / aspect, width, rotate: angle(L.shoulderR, L.shoulderL) };
    placements.accessory = { left: (seen(L.wristL) ? pose[L.wristL].x : shoulders.x + span) - span * 0.25, top: seen(L.wristL) ? pose[L.wristL].y - (span * 0.2) / aspect : shoulders.y + (span * 1.4) / aspect, width: span * 0.55, rotate: 0 };
  }
  if (seen(L.hipL) && seen(L.hipR)) {
    const hips = mid(L.hipL, L.hipR);
    const span = distance(L.hipL, L.hipR);
    const width = span * 2.3;
    placements.bottom = { left: hips.x - width / 2, top: hips.y - (span * 0.25) / aspect, width, rotate: angle(L.hipR, L.hipL) };
  }
  if (seen(L.ankleL) && seen(L.ankleR)) {
    const ankles = mid(L.ankleL, L.ankleR);
    const hipSpan = seen(L.hipL) && seen(L.hipR) ? distance(L.hipL, L.hipR) : 0.12;
    const width = Math.max(distance(L.ankleL, L.ankleR) + hipSpan * 0.9, hipSpan * 1.6);
    placements.shoes = { left: ankles.x - width / 2, top: ankles.y - (hipSpan * 0.25) / aspect, width, rotate: 0 };
  }
  return placements;
}

// Le cadre d'ajustement de chaque pièce, en pixels de la photo : le vêtement est étiré pour couvrir
// ce cadre (des épaules aux hanches, des hanches aux chevilles), puis découpé selon la silhouette.
// « fit » : la pièce remplit le cadre ; sinon elle garde ses proportions (chaussures, accessoire).
export type Frame = { x: number; y: number; width: number; height: number; rotate: number; fit: boolean; clip: boolean };

export function fitFrames(pose: Pose | null, width: number, height: number): Partial<Record<Slot, Frame>> {
  if (!pose) return {};
  const p = (index: number) => ({ x: pose[index].x * width, y: pose[index].y * height, ok: (pose[index]?.visibility ?? 1) > 0.4 });
  const [sl, sr, hl, hr, al, ar, wl, wr] = [L.shoulderL, L.shoulderR, L.hipL, L.hipR, L.ankleL, L.ankleR, L.wristL, L.wristR].map(p);
  const frames: Partial<Record<Slot, Frame>> = {};

  if (sl.ok && sr.ok) {
    const shoulders = { x: (sl.x + sr.x) / 2, y: (sl.y + sr.y) / 2 };
    const span = Math.hypot(sl.x - sr.x, sl.y - sr.y);
    // Sans hanches visibles, le torse fait environ 1,5 fois la carrure.
    const hipY = hl.ok && hr.ok ? (hl.y + hr.y) / 2 : shoulders.y + span * 1.5;
    const torso = hipY - shoulders.y;
    const top = shoulders.y - span * 0.2;
    const frameWidth = span * 1.8;
    frames.top = {
      x: shoulders.x - frameWidth / 2,
      y: top,
      width: frameWidth,
      height: hipY + torso * 0.18 - top,
      rotate: (Math.atan2(sl.y - sr.y, sl.x - sr.x) * 180) / Math.PI - (sl.x >= sr.x ? 0 : 180),
      fit: true,
      clip: true,
    };
    const wrist = wl.ok && (!wr.ok || wl.y >= wr.y) ? wl : wr.ok ? wr : null;
    const size = span * 0.5;
    frames.accessory = { x: (wrist?.x ?? shoulders.x + span) - size / 2, y: (wrist?.y ?? hipY) - size * 0.2, width: size, height: size, rotate: 0, fit: false, clip: false };
  }
  if (hl.ok && hr.ok) {
    const hips = { x: (hl.x + hr.x) / 2, y: (hl.y + hr.y) / 2 };
    const hipSpan = Math.hypot(hl.x - hr.x, hl.y - hr.y);
    const ankles = al.ok && ar.ok ? { x: (al.x + ar.x) / 2, y: (al.y + ar.y) / 2 } : { x: hips.x, y: hips.y + hipSpan * 4 };
    const legs = ankles.y - hips.y;
    const spread = al.ok && ar.ok ? Math.abs(al.x - ar.x) : 0;
    const frameWidth = Math.max(hipSpan * 2.1, spread + hipSpan * 1.3);
    frames.bottom = { x: (hips.x + ankles.x) / 2 - frameWidth / 2, y: hips.y - legs * 0.07, width: frameWidth, height: legs * 1.1, rotate: 0, fit: true, clip: true };
    if (al.ok && ar.ok) {
      const shoeWidth = spread + hipSpan * 1.2;
      frames.shoes = { x: ankles.x - shoeWidth / 2, y: ankles.y - hipSpan * 0.35, width: shoeWidth, height: hipSpan * 0.9, rotate: 0, fit: false, clip: false };
    }
  }
  return frames;
}
