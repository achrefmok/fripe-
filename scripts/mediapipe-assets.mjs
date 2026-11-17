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
// Deux modèles, tous deux sous licence Apache 2.0 : la pose (BlazePose) et le détourage par point (MagicTouch).
const MODELS = [
  ["https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task", "pose_landmarker_lite.task"],
  ["https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/latest/magic_touch.tflite", "magic_touch.tflite"],
];

if (!existsSync(SOURCE)) {
  console.warn("[mediapipe] @mediapipe/tasks-vision absent : essayage virtuel non préparé.");
  process.exit(0);
}

mkdirSync(join(TARGET, "wasm"), { recursive: true });
for (const file of ["vision_wasm_internal.js", "vision_wasm_internal.wasm"]) {
  copyFileSync(join(SOURCE, file), join(TARGET, "wasm", file));
}

for (const [url, name] of MODELS) {
  const file = join(TARGET, name);
  if (existsSync(file) && statSync(file).size > 1_000_000) continue;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    console.log(`[mediapipe] ${name} téléchargé (${Math.round(statSync(file).size / 1024)} Ko).`);
  } catch (error) {
    // Sans réseau, l'installation continue : l'essayage dira qu'il est indisponible ou se rabattra.
    console.warn(`[mediapipe] ${name} non téléchargé (${error.message}).`);
  }
}
console.log("[mediapipe] fichiers prêts.");
