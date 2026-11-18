import { describe, expect, it } from "vitest";
import { isCoherentLook, suitsGender, wearPiece } from "@/features/stylist/engine";
import { classifyGarment, FIT_RULES, kindSuits, ruleKey, shortBottomFromTitle } from "@/features/stylist/tryon/garments/garment-config";
import { bottomLine, garmentScale, referenceOf, shellGeometry } from "@/features/stylist/tryon/garments/garment-fitting";
import { bottomFromShape, measureAlpha, toeSide } from "@/features/stylist/tryon/garments/garment-measure";
import { bodyProfile, buildMannequin } from "@/features/stylist/tryon/mannequin/build-mannequin";
import { createDepthMap, frontArc } from "@/features/stylist/tryon/mannequin/depth-map";
import { FEMALE } from "@/features/stylist/tryon/mannequin/female-mannequin";
import { MALE } from "@/features/stylist/tryon/mannequin/male-mannequin";

const TORSO = ["torso", "head", "legL", "legR", "footL", "footR"] as const;
const body = (definition: typeof FEMALE, morph: "mince" | "standard" | "large") => {
  const mannequin = buildMannequin(definition, morph);
  return { mannequin, torso: createDepthMap(mannequin, [...TORSO]) };
};
const female = body(FEMALE, "standard");
const male = body(MALE, "standard");

// Une photo synthétique : des rangées opaques entre deux bornes (RGBA, alpha seul utilisé).
function photo(width: number, height: number, inside: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (inside(x, y)) data[(y * width + x) * 4 + 3] = 255;
  return measureAlpha(data, width, height);
}

describe("deux mannequins réellement distincts", () => {
  it("l'homme est plus grand, aux épaules plus larges ; la femme a la taille plus marquée", () => {
    expect(male.mannequin.anchors.height).toBeGreaterThan(female.mannequin.anchors.height + 0.04);
    expect(male.mannequin.anchors.shoulderHalfWidth).toBeGreaterThan(female.mannequin.anchors.shoulderHalfWidth + 0.02);
    const ratio = (b: typeof female) => frontArc(b.torso, b.mannequin.anchors.waist) / frontArc(b.torso, b.mannequin.anchors.hip);
    expect(ratio(female)).toBeLessThan(ratio(male) - 0.05);
  });

  it("les sections ne sont pas celles de l'autre mannequin mises à l'échelle", () => {
    const shape = (definition: typeof FEMALE) => definition.torso.map((section) => section.rx / Math.max(...definition.torso.map((other) => other.rx)));
    expect(shape(FEMALE)).not.toEqual(shape(MALE));
    expect(FEMALE.torso.some((section) => section.bust)).toBe(true);
    expect(MALE.torso.some((section) => section.bust)).toBe(false);
  });

  it("le mannequin repose sur le sol, et chaque partie est une surface fermée", () => {
    for (const { mannequin } of [female, male]) {
      const lowest = Math.min(...mannequin.parts.map((part) => part.geometry.boundingBox!.min.y));
      expect(lowest).toBeCloseTo(0, 5);
      expect(mannequin.parts).toHaveLength(8);
    }
  });
});

describe("trois morphologies par mannequin", () => {
  it("la morphologie large prend surtout à la taille ; la mince affine", () => {
    for (const definition of [FEMALE, MALE]) {
      const [thin, standard, large] = (["mince", "standard", "large"] as const).map((morph) => body(definition, morph));
      const waist = (b: typeof female) => frontArc(b.torso, b.mannequin.anchors.waist);
      const shoulders = (b: typeof female) => b.mannequin.anchors.shoulderHalfWidth;
      expect(waist(thin)).toBeLessThan(waist(standard));
      expect(waist(large)).toBeGreaterThan(waist(standard) * 1.2);
      // Pas une simple mise à l'échelle : les épaules bougent bien moins que la taille.
      expect(shoulders(large) / shoulders(standard)).toBeLessThan(waist(large) / waist(standard));
      // La hauteur ne change pas.
      expect(large.mannequin.anchors.height).toBeCloseTo(standard.mannequin.anchors.height, 2);
    }
  });

  it("les bras s'écartent quand les hanches s'élargissent", () => {
    const arm = (morph: "standard" | "large") => bodyProfile(FEMALE, morph).parts.find((part) => part.name === "armL")!.sections.at(-3)!.at[0];
    expect(arm("large")).toBeGreaterThan(arm("standard"));
  });
});

describe("type des pièces", () => {
  it("catégorie et titre donnent le type", () => {
    expect(classifyGarment({ rootSlug: "hauts", subSlug: "t-shirts", title: "T-shirt blanc" })).toBe("tshirt");
    expect(classifyGarment({ rootSlug: "hauts", subSlug: "t-shirts", title: "Polo Lacoste" })).toBe("polo");
    expect(classifyGarment({ rootSlug: "vestes-manteaux", subSlug: "manteaux", title: "Manteau laine" })).toBe("coat");
    expect(classifyGarment({ rootSlug: "bas", subSlug: "jeans", title: "Short en jean" })).toBe("shorts");
    expect(classifyGarment({ rootSlug: "robes", subSlug: null, title: "Robe d'été" })).toBe("dress");
    expect(classifyGarment({ rootSlug: "accessoires", subSlug: "sacs", title: "Cabas" })).toBe("bag");
  });

  it("jupe ou short : sans mot clair dans le titre, rien n'est forcé", () => {
    expect(classifyGarment({ rootSlug: "bas", subSlug: "jupes-shorts", title: "Jupe plissée" })).toBe("skirt");
    expect(classifyGarment({ rootSlug: "bas", subSlug: "jupes-shorts", title: "Bermuda cargo" })).toBe("shorts");
    expect(classifyGarment({ rootSlug: "bas", subSlug: "jupes-shorts", title: "Pièce vintage beige" })).toBeNull();
    expect(shortBottomFromTitle("Jupe-short")).toBeNull();
    expect(shortBottomFromTitle("تنورة طويلة")).toBe("skirt");
    expect(shortBottomFromTitle("شورت صيفي")).toBe("shorts");
  });

  it("la forme de la photo tranche seulement quand elle est nette", () => {
    const shorts = photo(100, 80, (x, y) => (y < 60 ? x > 10 && x < 90 : (x > 10 && x < 45) || (x > 55 && x < 90)));
    const skirt = photo(100, 80, (x, y) => x > 20 - y / 6 && x < 80 + y / 6);
    expect(bottomFromShape(shorts)).toBe("shorts");
    expect(bottomFromShape(skirt)).toBe("skirt");
  });

  it("robes et jupes : mannequin femme seulement ; le reste va aux deux", () => {
    expect(kindSuits("dress", "homme")).toBe(false);
    expect(kindSuits("skirt", "homme")).toBe(false);
    expect(kindSuits("shorts", "homme")).toBe(true);
    expect(kindSuits(null, "homme")).toBe(true);
    expect(kindSuits("dress", "femme")).toBe(true);
  });

  it("l'attribut « Pour » filtre ; mixte et sans attribut restent visibles", () => {
    expect(suitsGender({ gender: "femme" }, "homme")).toBe(false);
    expect(suitsGender({ gender: "mixte" }, "homme")).toBe(true);
    expect(suitsGender({ gender: null }, "femme")).toBe(true);
    expect(suitsGender({ gender: "homme" }, null)).toBe(true);
  });
});

describe("tenue cohérente", () => {
  it("la robe remplace le haut et le bas, et inversement", () => {
    const { pieces, removed } = wearPiece({ top: "t", bottom: "b", shoes: "s" }, "dress", "d");
    expect(pieces).toEqual({ dress: "d", shoes: "s" });
    expect(removed).toEqual(["top", "bottom"]);
    expect(wearPiece({ dress: "d" }, "top", "t").pieces).toEqual({ top: "t" });
    expect(wearPiece({ top: "t" }, "outer", "o").pieces).toEqual({ top: "t", outer: "o" });
    expect(isCoherentLook(["dress", "top"])).toBe(false);
    expect(isCoherentLook(["top", "outer", "bottom"])).toBe(true);
  });
});

describe("pièces posées sans déformation", () => {
  const reference = referenceOf(female.mannequin, female.torso);
  const maps = { full: createDepthMap(female.mannequin, ["torso", "head", "armL", "armR", "legL", "legR", "footL", "footR"]), torso: female.torso };
  const fit = (shape: ReturnType<typeof photo>, key: Parameters<typeof ruleKey>[0], slot: Parameters<typeof ruleKey>[1]) =>
    shellGeometry({ mannequin: female.mannequin, maps, rule: FIT_RULES[ruleKey(key, slot)], shape, reference, adjust: { scale: 1, dy: 0 } });

  it("une seule échelle : la pièce garde le rapport hauteur/largeur de sa photo", () => {
    const shape = photo(200, 300, () => true);
    const { widthMeters, heightMeters } = fit(shape, "tshirt", "top");
    expect(heightMeters / widthMeters).toBeCloseTo(1.5, 5);
  });

  it("un short reste court, un pantalon descend aux chevilles", () => {
    const shorts = photo(200, 150, () => true);
    const pants = photo(200, 560, () => true);
    const anchors = female.mannequin.anchors;
    const short = fit(shorts, "shorts", "bottom");
    const long = fit(pants, "pants", "bottom");
    expect(short.top - short.heightMeters).toBeGreaterThan(anchors.knee);
    expect(long.top - long.heightMeters).toBeLessThan(anchors.knee * 0.5);
    expect(short.top).toBeCloseTo(bottomLine(anchors), 5);
  });

  it("la veste passe au-dessus du haut", () => {
    const shape = photo(200, 240, () => true);
    const z = (geometry: ReturnType<typeof fit>["geometry"]) => {
      const position = geometry.getAttribute("position");
      // Le milieu de la rangée centrale.
      return position.getZ(45 * 64 + 32);
    };
    expect(z(fit(shape, "jacket", "outer").geometry)).toBeGreaterThan(z(fit(shape, "tshirt", "top").geometry));
  });

  it("chaussures de profil : la pointe est le côté le plus bas ; l'échelle suit la longueur du pied", () => {
    const shoe = photo(120, 50, (x, y) => (x < 40 ? y > 5 : y > 25));
    expect(toeSide(shoe)).toBe("right");
    expect(garmentScale(FIT_RULES.shoes, shoe, reference) * 120).toBeCloseTo(reference.foot * FIT_RULES.shoes.ease, 5);
  });
});
