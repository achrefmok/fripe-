// Prépare les fichiers de l'essayage virtuel, servis par le site lui-même (la CSP n'autorise aucun
// script externe) : le module WebAssembly de MediaPipe, copié depuis node_modules, et le modèle de
// détection de pose (BlazePose, licence Apache 2.0), téléchargé une fois depuis le dépôt officiel.
// Lancé après chaque installation (postinstall). Les fichiers restent hors de git (public/mediapipe/).
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SOURCE = join(ROOT, "node_modules/@mediapipe/tasks-vision/wasm");
const TARGET = join(ROOT, "public/mediapipe");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const MODEL = join(TARGET, "pose_landmarker_lite.task");

if (!existsSync(SOURCE)) {
  console.warn("[mediapipe] @mediapipe/tasks-vision absent : essayage virtuel non préparé.");
  process.exit(0);
}

mkdirSync(join(TARGET, "wasm"), { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) {
  copyFileSync(join(SOURCE, file), join(TARGET, "wasm", file));
}

if (existsSync(MODEL) && statSync(MODEL).size > 1_000_000) {
  console.log("[mediapipe] fichiers prêts.");
} else {
  try {
    const response = await fetch(MODEL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    mkdirSync(dirname(MODEL), { recursive: true });
    writeFileSync(MODEL, Buffer.from(await response.arrayBuffer()));
    console.log(`[mediapipe] modèle de pose téléchargé (${Math.round(statSync(MODEL).size / 1024)} Ko).`);
  } catch (error) {
    // Sans réseau, l'installation continue : l'essayage affichera qu'il est indisponible.
    console.warn(`[mediapipe] modèle non téléchargé (${error.message}) : l'essayage restera indisponible.`);
  }
}
