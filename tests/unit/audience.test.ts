import { describe, expect, it } from "vitest";
import {
  AUDIENCES,
  audienceValues,
  matchesAudience,
  sectionAttributes,
  sectionAttributeValues,
} from "@/features/catalog/audience";
import { catalogFiltersSchema } from "@/features/catalog/schemas";
import { suitsGender } from "@/features/stylist/engine";
import { parseMarketFilters } from "@/features/marketplace/schemas";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";

describe("filtre Femme, Homme, Enfant", () => {
  it("une pièce mixte convient à une femme comme à un homme, pas à un enfant", () => {
    expect(audienceValues("femme")).toEqual(["femme", "mixte"]);
    expect(audienceValues("homme")).toEqual(["homme", "mixte"]);
    expect(audienceValues("enfant")).toEqual(["enfant"]);
  });

  it("suit la même règle que la cabine d'essayage pour les adultes", () => {
    for (const genre of ["femme", "homme", "mixte", "enfant"]) {
      for (const audience of ["femme", "homme"] as const) {
        expect(matchesAudience({ genre }, audience)).toBe(suitsGender({ gender: genre }, audience));
      }
    }
  });

  it("une pièce sans « Pour qui » n'apparaît que sans filtre", () => {
    expect(matchesAudience({}, undefined)).toBe(true);
    expect(matchesAudience({}, "femme")).toBe(false);
    expect(matchesAudience(null, "enfant")).toBe(false);
  });

  it("le paramètre « pour » est lu par la recherche Mode et par le Vide-Dressing", () => {
    expect(catalogFiltersSchema.parse({ pour: "homme" }).pour).toBe("homme");
    expect(parseMarketFilters({ pour: "enfant" }).pour).toBe("enfant");
    expect(parseMarketFilters({ pour: ["femme", "homme"] }).pour).toBe("femme");
  });

  it("une valeur inconnue est ignorée, sans erreur", () => {
    expect(catalogFiltersSchema.parse({ pour: "chat" }).pour).toBeUndefined();
    expect(parseMarketFilters({ pour: "mixte" }).pour).toBeUndefined();
    expect(catalogFiltersSchema.parse({}).pour).toBeUndefined();
  });

  it("le Vide-Dressing ne garde que le « Pour qui » parmi les caractéristiques", () => {
    const attributes = [{ key: "genre" }, { key: "coupe" }, { key: "matiere" }];
    expect(sectionAttributes("vide_dressing", attributes)).toEqual([{ key: "genre" }]);
    expect(sectionAttributes("marketplace", attributes)).toBe(attributes);
    expect(sectionAttributeValues("vide_dressing", { genre: "femme", coupe: "ample" })).toEqual({ genre: "femme" });
    expect(sectionAttributeValues("vide_dressing", { coupe: "ample" })).toEqual({});
    expect(sectionAttributeValues("marketplace", { marque: "Bosch" })).toEqual({ marque: "Bosch" });
  });

  it("les libellés existent en français et en arabe", () => {
    for (const audience of AUDIENCES) {
      expect(fr.audience[audience]).toBeTruthy();
      expect(ar.audience[audience]).toBeTruthy();
    }
    expect(fr.audience).toMatchObject({ femme: "Femme", homme: "Homme", enfant: "Enfant" });
  });
});
