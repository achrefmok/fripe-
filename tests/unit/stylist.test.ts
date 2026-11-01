import { describe, expect, it } from "vitest";
import {
  findCheaperOutfit,
  fitsInput,
  getStylistEngine,
  outfitTotal,
  scoreItem,
  slotOfCategory,
  type StyleItem,
  type StylistInput,
} from "@/features/stylist/engine";
import { detectVideoKind } from "@/lib/utils/image-file";
import { formatDuration } from "@/lib/utils/format";

let counter = 0;

function item(overrides: Partial<StyleItem>): StyleItem {
  counter += 1;

  return {
    id: `id-${String(counter).padStart(3, "0")}`,
    title: "Pièce",
    brand: null,
    size: "M",
    color: null,
    description: null,
    priceMillimes: 20000,
    slot: "top",
    categoryId: "cat-top",
    shopName: "Boutique",
    imagePath: null,
    ...overrides,
  };
}

const baseInput: StylistInput = {
  size: "M",
  shoeSize: "",
  budgetMillimes: 100000,
  style: "",
  occasion: "",
  colors: [],
};

describe("moteur de recommandation", () => {
  it("compose une tenue dans le budget, uniquement à partir du catalogue", () => {
    const catalog = [
      item({ title: "Sweat", priceMillimes: 30000 }),
      item({ title: "Jean", slot: "bottom", priceMillimes: 30000 }),
      item({ title: "Baskets", slot: "shoes", size: "42", priceMillimes: 35000 }),
    ];

    const [outfit] = getStylistEngine().recommend(baseInput, catalog);

    expect(outfit.items).toHaveLength(3);
    expect(outfit.totalMillimes).toBe(95000);
    expect(outfit.items.every((piece) => catalog.includes(piece))).toBe(true);
  });

  it("ne dépasse jamais le budget", () => {
    const catalog = [
      item({ priceMillimes: 60000 }),
      item({ slot: "bottom", priceMillimes: 50000 }),
    ];

    expect(getStylistEngine().recommend(baseInput, catalog)).toEqual([]);
  });

  it("ne propose rien sans pièce adaptée plutôt que d'inventer", () => {
    expect(getStylistEngine().recommend(baseInput, [])).toEqual([]);
    expect(getStylistEngine().recommend(baseInput, [item({ size: "XXL" }), item({ slot: "bottom" })])).toEqual([]);
  });

  it("donne le même résultat à chaque appel", () => {
    const catalog = [
      item({ title: "A" }),
      item({ title: "B" }),
      item({ title: "C", slot: "bottom" }),
      item({ title: "D", slot: "bottom" }),
    ];

    const first = getStylistEngine().recommend(baseInput, catalog);
    const second = getStylistEngine().recommend(baseInput, [...catalog].reverse());

    expect(second).toEqual(first);
  });

  it("n'utilise pas deux fois la même pièce unique", () => {
    const catalog = [item({}), item({}), item({ slot: "bottom" }), item({ slot: "bottom" })];
    const outfits = getStylistEngine().recommend(baseInput, catalog);
    const ids = outfits.flatMap((outfit) => outfit.items.map((piece) => piece.id));

    expect(outfits).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("privilégie couleur, style et occasion", () => {
    const input: StylistInput = { ...baseInput, colors: ["noir"], style: "streetwear", occasion: "everyday" };
    const plain = item({ title: "Chemise" });
    const match = item({ title: "Sweat oversize", color: "Noir" });

    expect(scoreItem(match, input)).toBeGreaterThan(scoreItem(plain, input));

    const [outfit] = getStylistEngine().recommend(input, [plain, match, item({ slot: "bottom" })]);
    expect(outfit.items[0].id).toBe(match.id);
  });

  it("filtre taille et pointure, pas les accessoires", () => {
    expect(fitsInput(item({ size: "m" }), baseInput)).toBe(true);
    expect(fitsInput(item({ size: "L" }), baseInput)).toBe(false);
    expect(fitsInput(item({ slot: "accessory", size: null }), baseInput)).toBe(true);
    expect(fitsInput(item({ slot: "shoes", size: "42" }), { ...baseInput, shoeSize: "43" })).toBe(false);
    expect(fitsInput(item({ slot: "shoes", size: "42" }), baseInput)).toBe(true);
  });

  it("classe les catégories par emplacement de tenue", () => {
    expect(slotOfCategory("hauts")).toBe("top");
    expect(slotOfCategory("vestes-manteaux")).toBe("top");
    expect(slotOfCategory("bas")).toBe("bottom");
    expect(slotOfCategory("chaussures")).toBe("shoes");
    expect(slotOfCategory("accessoires")).toBe("accessory");
    expect(slotOfCategory("inconnue")).toBeNull();
    expect(slotOfCategory(undefined)).toBeNull();
  });
});

describe("tenue similaire moins chère", () => {
  it("calcule le prix total sans erreur d'arrondi", () => {
    expect(outfitTotal([{ priceMillimes: 19999 }, { priceMillimes: 1 }, { priceMillimes: 35500 }])).toBe(55500);
  });

  it("remplace par une pièce moins chère de la même catégorie", () => {
    const expensive = item({ title: "Cher", priceMillimes: 50000, color: "Noir" });
    const similar = item({ title: "Proche", priceMillimes: 30000, color: "noir" });
    const cheapest = item({ title: "Autre", priceMillimes: 10000, color: "Rouge" });
    const wrongCategory = item({ priceMillimes: 1000, categoryId: "autre" });

    const result = findCheaperOutfit([expensive], [expensive, similar, cheapest, wrongCategory]);

    expect(result?.items[0].id).toBe(similar.id);
    expect(result?.savingMillimes).toBe(20000);
  });

  it("ne renvoie rien quand aucune économie n'existe", () => {
    const piece = item({ priceMillimes: 10000 });
    expect(findCheaperOutfit([piece], [piece, item({ priceMillimes: 20000 })])).toBeNull();
  });

  it("ne remplace pas deux pièces par la même alternative", () => {
    const first = item({ priceMillimes: 40000 });
    const second = item({ priceMillimes: 45000 });
    const only = item({ priceMillimes: 20000 });

    const result = findCheaperOutfit([first, second], [first, second, only]);
    const ids = result?.items.map((piece) => piece.id) ?? [];

    expect(new Set(ids).size).toBe(2);
  });
});

describe("fichiers vidéo", () => {
  const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

  it("reconnaît MP4, MOV et WebM par leur signature", () => {
    expect(detectVideoKind(new Uint8Array([0, 0, 0, 24, ...ascii("ftypisom")]))?.mime).toBe("video/mp4");
    expect(detectVideoKind(new Uint8Array([0, 0, 0, 20, ...ascii("ftypqt  ")]))?.mime).toBe("video/quicktime");
    expect(detectVideoKind(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]))?.mime).toBe("video/webm");
  });

  it("refuse un fichier déguisé", () => {
    expect(detectVideoKind(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(detectVideoKind(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });
});

describe("durée de réservation", () => {
  it("s'affiche selon la valeur réglée", () => {
    const clean = (value: string) => value.replace(/\s/g, " ");

    expect(clean(formatDuration(120, "fr"))).toBe("2 heures");
    expect(clean(formatDuration(90, "fr"))).toBe("1 heure 30 minutes");
    expect(clean(formatDuration(45, "fr"))).toBe("45 minutes");
  });
});
