// Détection de pose pour l'essayage virtuel, entièrement dans le navigateur : la photo ne quitte
// jamais l'appareil. MediaPipe Pose Landmarker (code et modèle BlazePose sous licence Apache 2.0),
// servi par le site depuis /mediapipe (scripts/mediapipe-assets.mjs). Chargé seulement à la demande.
import type { Slot } from "../engine";

type Point = { x: number; y: number; visibility?: number };
export type Pose = Point[];

type Landmarker = { detect: (image: HTMLImageElement) => { landmarks: Point[][] }; close: () => void };
let landmarker: Promise<Landmarker> | null = null;

async function create(delegate: "GPU" | "CPU") {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const files = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task", delegate },
    runningMode: "IMAGE",
    numPoses: 1,
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

export async function detectPose(image: HTMLImageElement): Promise<Pose | null> {
  const model = await getLandmarker();
  return model.detect(image).landmarks[0] ?? null;
}

// Où poser chaque pièce, en fractions de la photo : left et top du coin haut-gauche, largeur en
// fraction de la largeur, rotation en degrés. La hauteur suit la photo de la pièce.
export type Placement = { left: number; top: number; width: number; rotate: number };

const L = { shoulderL: 11, shoulderR: 12, wristL: 15, hipL: 23, hipR: 24, kneeL: 25, kneeR: 26, ankleL: 27, ankleR: 28 } as const;

export function placeGarments(pose: Pose | null, aspect: number): Record<Slot, Placement> {
  // Sans pose détectée : des positions par défaut, que l'on ajuste à la main.
  const fallback: Record<Slot, Placement> = {
    top: { left: 0.3, top: 0.18, width: 0.4, rotate: 0 },
    bottom: { left: 0.33, top: 0.48, width: 0.34, rotate: 0 },
    shoes: { left: 0.36, top: 0.86, width: 0.28, rotate: 0 },
    accessory: { left: 0.68, top: 0.42, width: 0.18, rotate: 0 },
  };
  if (!pose) return fallback;

  const seen = (index: number) => (pose[index]?.visibility ?? 1) > 0.4;
  const mid = (a: number, b: number) => ({ x: (pose[a].x + pose[b].x) / 2, y: (pose[a].y + pose[b].y) / 2 });
  // Distance en fractions de largeur : les y sont ramenés à l'échelle des x (aspect = hauteur / largeur).
  const distance = (a: number, b: number) => Math.hypot(pose[a].x - pose[b].x, (pose[a].y - pose[b].y) * aspect);
  const angle = (a: number, b: number) => {
    const degrees = (Math.atan2((pose[b].y - pose[a].y) * aspect, pose[b].x - pose[a].x) * 180) / Math.PI;
    // L'épaule gauche de la personne est à droite de l'image : on ramène l'angle autour de 0.
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
