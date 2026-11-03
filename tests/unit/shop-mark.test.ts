import { describe, expect, it } from "vitest";
import { shopInitials, shopTone } from "@/features/shops/components/shop-mark";

describe("monogramme de boutique", () => {
  it("écarte les mots trop courants pour distinguer les boutiques", () => {
    expect(shopInitials("Boutique Démo A")).toBe("DA");
    expect(shopInitials("Boutique Démo B")).toBe("DB");
    expect(shopInitials("La Friperie de Sfax")).toBe("S");
    expect(shopInitials("Chez l'artisan")).toBe("A");
  });

  it("garde un nom fait uniquement de mots courants", () => {
    expect(shopInitials("La Boutique")).toBe("LB");
  });

  it("fonctionne en arabe", () => {
    expect(shopInitials("فريب تونس")).toBe("فت");
  });

  it("donne toujours la même couleur à la même boutique", () => {
    expect(shopTone("Boutique Démo A")).toEqual(shopTone("Boutique Démo A"));
    expect(shopTone("Boutique Démo A")).not.toEqual(shopTone("Boutique Démo B"));
  });
});
