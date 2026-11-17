// Détourage d'une photo de pièce par l'IA (MediaPipe MagicTouch, Apache 2.0), dans le navigateur.
// Le modèle reçoit un trait au centre de la photo, là où se trouve presque toujours la pièce, et rend
// la silhouette de l'objet touché. Si le résultat n'est pas crédible, on se rabat sur le détourage
// par couleur de fond (src/lib/ui/cutout.ts), puis sur la photo entière.
import { cutoutUrl } from "@/lib/ui/cutout";
import { visionFileset } from "./pose";

type Mask = { width: number; height: number; getAsFloat32Array: () => Float32Array };
type Result = { confidenceMasks?: Mask[] };
// La classe « Legacy » lit le modèle MagicTouch (.tflite) ; la nouvelle classe attend un autre format de paquet.
type Segmenter = { segment: (image: TexImageSource, roi: { scribble: { x: number; y: number }[] }, callback: (result: Result) => void) => void };

let segmenter: Promise<Segmenter> | null = null;
function getSegmenter() {
  segmenter ??= (async () => {
    const [{ InteractiveSegmenterLegacy }, files] = await Promise.all([import("@mediapipe/tasks-vision"), visionFileset()]);
    return InteractiveSegmenterLegacy.createFromOptions(files as never, {
      baseOptions: { modelAssetPath: "/mediapipe/magic_touch.tflite" },
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    }) as unknown as Segmenter;
  })();
  segmenter.catch(() => {
    segmenter = null;
  });
  return segmenter;
}

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = src;
  });
}

const MAX_SIDE = 768;

// Une toile à la taille raisonnable pour l'appareil (les photos font jusqu'à 1 600 px).
function toCanvas(image: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width: number; height: number }) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Recadre la toile sur ce qui n'est pas transparent.
function crop(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d")!;
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return canvas;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d")!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

async function segmentWithAi(image: HTMLImageElement) {
  const model = await getSegmenter();
  const canvas = toCanvas(image);
  // Un trait vertical au centre : il couvre la pièce, pas seulement un bouton ou un motif.
  let picked: { values: Float32Array; width: number; height: number } | null = null;
  model.segment(canvas, { scribble: [{ x: 0.5, y: 0.32 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.68 }] }, (result) => {
    // Les masques ne vivent que pendant l'appel : on copie celui de l'objet, le plus fort au centre.
    for (const mask of result.confidenceMasks ?? []) {
      const values = mask.getAsFloat32Array();
      const center = values[Math.floor(mask.height / 2) * mask.width + Math.floor(mask.width / 2)];
      const best = picked ? picked.values[Math.floor(picked.height / 2) * picked.width + Math.floor(picked.width / 2)] : -1;
      if (center > best) picked = { values: values.slice(), width: mask.width, height: mask.height };
    }
  });
  if (!picked) return null;
  const { values, width: maskWidth, height: maskHeight } = picked as { values: Float32Array; width: number; height: number };

  const coverage = values.reduce((sum, value) => sum + (value > 0.5 ? 1 : 0), 0) / values.length;
  // Moins de 4 % : l'IA n'a touché qu'un détail ; plus de 92 % : elle a pris le fond avec.
  if (coverage < 0.04 || coverage > 0.92) return null;

  const alpha = document.createElement("canvas");
  alpha.width = maskWidth;
  alpha.height = maskHeight;
  const alphaContext = alpha.getContext("2d")!;
  const pixels = alphaContext.createImageData(maskWidth, maskHeight);
  for (let index = 0; index < values.length; index++) {
    // Bord adouci : la confiance du modèle devient la transparence.
    pixels.data[index * 4 + 3] = Math.max(0, Math.min(255, (values[index] - 0.3) * 640));
  }
  alphaContext.putImageData(pixels, 0, 0);

  const context = canvas.getContext("2d")!;
  context.globalCompositeOperation = "destination-in";
  context.drawImage(alpha, 0, 0, canvas.width, canvas.height);
  return crop(canvas);
}

// La pièce détourée, prête à être posée sur la photo de la personne.
export async function garmentCutout(src: string): Promise<{ canvas: HTMLCanvasElement; quality: "ai" | "color" | "photo" }> {
  const image = await load(src);
  try {
    const cut = await segmentWithAi(image);
    if (cut) return { canvas: cut, quality: "ai" };
  } catch {
    // Modèle indisponible : on passe au détourage par couleur.
  }
  const color = await cutoutUrl(src).catch(() => null);
  if (color) return { canvas: crop(toCanvas(await load(color))), quality: "color" };
  return { canvas: toCanvas(image), quality: "photo" };
}
