// Le rendu de l'essayage, dans une toile : la photo de la personne, puis chaque pièce étirée dans son
// cadre (pose.ts), découpée selon la silhouette et ombrée avec la lumière et les plis de la photo.
import type { Slot } from "../engine";
import type { BodyMask, Frame } from "./pose";

// Le bas, la robe, les chaussures, le haut, la veste par-dessus, puis l'accessoire.
export const LAYERS: Slot[] = ["bottom", "dress", "shoes", "top", "outer", "accessory"];
export type Adjust = { dx: number; dy: number; scale: number };

function layer(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// La silhouette en couche alpha, à la taille de la photo, légèrement élargie et adoucie.
export function maskCanvas(mask: BodyMask, width: number, height: number) {
  const small = layer(mask.width, mask.height);
  const context = small.getContext("2d")!;
  const pixels = context.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.data.length; index++) {
    pixels.data[index * 4 + 3] = Math.max(0, Math.min(255, (mask.data[index] - 0.25) * 510));
  }
  context.putImageData(pixels, 0, 0);
  const full = layer(width, height);
  const fullContext = full.getContext("2d")!;
  fullContext.filter = "blur(2px)";
  fullContext.drawImage(small, 0, 0, width, height);
  return full;
}

// Le cadre réellement occupé : ajusté (déplacement, taille) et, sans « fit », aux proportions de la pièce.
export function placedFrame(frame: Frame, garment: HTMLCanvasElement, adjust: Adjust): Frame {
  let { width, height } = frame;
  if (!frame.fit) {
    const ratio = garment.height / garment.width;
    height = width * ratio;
    if (height > frame.height * 1.6) {
      height = frame.height * 1.6;
      width = height / ratio;
    }
  }
  width *= adjust.scale;
  height *= adjust.scale;
  return {
    ...frame,
    x: frame.x + frame.width / 2 - width / 2 + adjust.dx,
    y: frame.y + (frame.fit ? 0 : (frame.height - height) / 2) + adjust.dy,
    width,
    height,
  };
}

export function render(
  canvas: HTMLCanvasElement,
  photo: CanvasImageSource,
  body: HTMLCanvasElement | null,
  garments: Partial<Record<Slot, HTMLCanvasElement>>,
  frames: Partial<Record<Slot, Frame>>,
  adjusts: Partial<Record<Slot, Adjust>>,
  selected: Slot | null,
) {
  const { width, height } = canvas;
  const context = canvas.getContext("2d")!;
  context.globalCompositeOperation = "source-over";
  context.drawImage(photo, 0, 0, width, height);

  // Les ombres et les plis de la photo, en niveaux de gris : ils passent sur le tissu.
  const shade = layer(width, height);
  const shadeContext = shade.getContext("2d")!;
  shadeContext.filter = "grayscale(1) contrast(1.25)";
  shadeContext.drawImage(photo, 0, 0, width, height);

  for (const slot of LAYERS) {
    const garment = garments[slot];
    const frame = frames[slot];
    if (!garment || !frame) continue;
    const place = placedFrame(frame, garment, adjusts[slot] ?? { dx: 0, dy: 0, scale: 1 });

    const piece = layer(width, height);
    const pieceContext = piece.getContext("2d")!;
    pieceContext.save();
    pieceContext.translate(place.x + place.width / 2, place.y);
    pieceContext.rotate((place.rotate * Math.PI) / 180);
    pieceContext.drawImage(garment, -place.width / 2, 0, place.width, place.height);
    pieceContext.restore();

    // Le haut et le bas épousent la silhouette : rien ne déborde sur le décor.
    if (place.clip && body) {
      pieceContext.globalCompositeOperation = "destination-in";
      pieceContext.drawImage(body, 0, 0, width, height);
    }

    // L'ombrage, limité à la pièce, puis fondu en lumière douce.
    if (place.clip) {
      const light = layer(width, height);
      const lightContext = light.getContext("2d")!;
      lightContext.drawImage(shade, 0, 0);
      lightContext.globalCompositeOperation = "destination-in";
      lightContext.drawImage(piece, 0, 0);
      pieceContext.globalCompositeOperation = "soft-light";
      pieceContext.globalAlpha = 0.85;
      pieceContext.drawImage(light, 0, 0);
      pieceContext.globalAlpha = 1;
    }

    context.drawImage(piece, 0, 0);

    if (slot === selected) {
      context.save();
      context.translate(place.x + place.width / 2, place.y);
      context.rotate((place.rotate * Math.PI) / 180);
      context.setLineDash([10, 8]);
      context.lineWidth = Math.max(2, width / 300);
      context.strokeStyle = "rgba(214, 178, 96, 0.95)";
      context.strokeRect(-place.width / 2, 0, place.width, place.height);
      context.restore();
    }
  }
}

// La pièce sous le doigt : on ramène le point dans le repère de chaque cadre, de la plus haute à la plus basse.
export function hitTest(
  x: number,
  y: number,
  garments: Partial<Record<Slot, HTMLCanvasElement>>,
  frames: Partial<Record<Slot, Frame>>,
  adjusts: Partial<Record<Slot, Adjust>>,
): Slot | null {
  for (const slot of [...LAYERS].reverse()) {
    const garment = garments[slot];
    const frame = frames[slot];
    if (!garment || !frame) continue;
    const place = placedFrame(frame, garment, adjusts[slot] ?? { dx: 0, dy: 0, scale: 1 });
    const angle = (-place.rotate * Math.PI) / 180;
    const px = x - (place.x + place.width / 2);
    const py = y - place.y;
    const rx = px * Math.cos(angle) - py * Math.sin(angle);
    const ry = px * Math.sin(angle) + py * Math.cos(angle);
    if (Math.abs(rx) <= place.width / 2 && ry >= 0 && ry <= place.height) return slot;
  }
  return null;
}
