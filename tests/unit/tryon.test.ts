import { describe, expect, it } from "vitest";
import { fitFrames, placeGarments, type Pose } from "@/features/stylist/tryon/pose";

// Une silhouette synthétique de face : 33 points MediaPipe, en fractions de la photo.
function pose(points: Record<number, [number, number]>): Pose {
  return Array.from({ length: 33 }, (_, index) => ({ x: points[index]?.[0] ?? 0.5, y: points[index]?.[1] ?? 0.5, visibility: points[index] ? 0.99 : 0.1 }));
}

const standing = pose({
  11: [0.6, 0.3], // épaule gauche (à droite de l'image)
  12: [0.4, 0.3], // épaule droite
  15: [0.68, 0.5], // poignet gauche
  23: [0.57, 0.55], // hanche gauche
  24: [0.43, 0.55], // hanche droite
  27: [0.54, 0.92], // cheville gauche
  28: [0.46, 0.92], // cheville droite
});

describe("placement des pièces sur la photo", () => {
  const placed = placeGarments(standing, 1.5);
  const center = (slot: keyof typeof placed) => placed[slot].left + placed[slot].width / 2;

  it("le haut est centré sur les épaules, plus large qu'elles, et commence juste au-dessus", () => {
    expect(center("top")).toBeCloseTo(0.5, 5);
    expect(placed.top.width).toBeGreaterThan(0.2);
    expect(placed.top.top).toBeLessThan(0.3);
    expect(Math.abs(placed.top.rotate)).toBeLessThan(1);
  });

  it("le bas commence aux hanches, les chaussures aux chevilles", () => {
    expect(center("bottom")).toBeCloseTo(0.5, 5);
    expect(placed.bottom.top).toBeLessThan(0.55);
    expect(placed.bottom.top).toBeGreaterThan(0.45);
    expect(center("shoes")).toBeCloseTo(0.5, 5);
    expect(placed.shoes.top).toBeGreaterThan(0.85);
  });

  it("l'accessoire va près de la main", () => {
    expect(placed.accessory.left).toBeGreaterThan(0.55);
  });

  it("des épaules inclinées inclinent le haut, dans le bon sens", () => {
    const tilted = placeGarments(pose({ 11: [0.6, 0.27], 12: [0.4, 0.33], 23: [0.57, 0.55], 24: [0.43, 0.55] }), 1.5);
    expect(tilted.top.rotate).toBeLessThan(-5);
    expect(Math.abs(tilted.top.rotate)).toBeLessThan(45);
  });

  it("sans silhouette détectée, des positions par défaut à ajuster à la main", () => {
    const fallback = placeGarments(null, 1.5);
    expect(fallback.top.left + fallback.top.width / 2).toBeCloseTo(0.5, 5);
    expect(fallback.shoes.top).toBeGreaterThan(fallback.bottom.top);
  });
});

describe("cadres d'ajustement en pixels (fitFrames)", () => {
  const frames = fitFrames(standing, 600, 900);

  it("le haut couvre des épaules jusque sous les hanches, centré", () => {
    const top = frames.top!;
    expect(top.x + top.width / 2).toBeCloseTo(300, 0);
    expect(top.y).toBeLessThan(0.3 * 900);
    expect(top.y + top.height).toBeGreaterThan(0.55 * 900);
    expect(top.fit && top.clip).toBe(true);
    expect(Math.abs(top.rotate)).toBeLessThan(1);
  });

  it("le bas couvre des hanches jusqu'aux chevilles", () => {
    const bottom = frames.bottom!;
    expect(bottom.y).toBeLessThan(0.55 * 900);
    expect(bottom.y + bottom.height).toBeGreaterThan(0.92 * 900);
    expect(bottom.clip).toBe(true);
  });

  it("les chaussures sont aux chevilles et gardent leurs proportions", () => {
    const shoes = frames.shoes!;
    expect(shoes.y).toBeLessThan(0.92 * 900);
    expect(shoes.y + shoes.height).toBeGreaterThan(0.92 * 900);
    expect(shoes.fit || shoes.clip).toBe(false);
  });

  it("une photo en miroir (épaules inversées) ne retourne pas le haut", () => {
    const mirrored = fitFrames(pose({ 11: [0.4, 0.3], 12: [0.6, 0.3], 23: [0.43, 0.55], 24: [0.57, 0.55] }), 600, 900);
    expect(Math.abs(mirrored.top!.rotate)).toBeLessThan(1);
  });

  it("sans silhouette, aucun cadre : l'interface passe en placement manuel", () => {
    expect(fitFrames(null, 600, 900)).toEqual({});
  });
});
