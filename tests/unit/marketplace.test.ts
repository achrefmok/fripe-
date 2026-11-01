import { describe, expect, it } from "vitest";
import { validateCsvRows, type CategoryOption } from "@/features/catalog/csv-import";
import { catalogFiltersSchema, normalizeCondition, productSchema } from "@/features/catalog/schemas";
import { getGarmentRecognizer } from "@/features/catalog/recognition";
import { checkoutSchema, nextOrderStatus } from "@/features/orders/schemas";
import { parseCsv } from "@/lib/utils/csv";
import { formatPrice, millimesToInput, parsePriceToMillimes } from "@/lib/utils/price";

const categories: CategoryOption[] = [
  { id: "7f1f8a5e-3c55-4f54-9d30-0a5a4f1f4a11", slug: "jeans", nameFr: "Jeans", nameAr: "جينز" },
];

const id = "7f1f8a5e-3c55-4f54-9d30-0a5a4f1f4a11";

describe("prix", () => {
  it.each([
    ["35", 35000],
    ["35,5", 35500],
    ["35.500", 35500],
    ["0,001", 1],
    ["1200", 1200000],
  ])("convertit %s en millimes", (input, expected) => {
    expect(parsePriceToMillimes(input)).toBe(expected);
  });

  it.each(["", "0", "-5", "12,3456", "abc", "1e3", "9999999"])("refuse %s", (input) => {
    expect(parsePriceToMillimes(input)).toBeNull();
  });

  it("évite les erreurs d'arrondi des flottants", () => {
    expect(parsePriceToMillimes("19,999")).toBe(19999);
    expect(parsePriceToMillimes("1,001")).toBe(1001);
  });

  it("affiche des dinars ronds sans décimales, sinon trois", () => {
    expect(formatPrice(35000, "fr")).toBe("35 DT");
    expect(formatPrice(35500, "fr")).toMatch(/^35,500 DT$/);
    expect(formatPrice(35000, "ar")).toContain("د.ت");
    expect(formatPrice(35000, "ar")).toContain("35");
  });

  it("restitue un prix saisissable", () => {
    expect(millimesToInput(35500)).toBe("35,5");
    expect(millimesToInput(35000)).toBe("35");
    expect(millimesToInput(null)).toBe("");
  });
});

describe("parseCsv", () => {
  it("lit le séparateur Excel français et les guillemets", () => {
    const rows = parseCsv('titre;prix\n"Veste; noire";30\n"Dit ""vintage""";12,5\n');
    expect(rows).toEqual([
      { titre: "Veste; noire", prix: "30" },
      { titre: 'Dit "vintage"', prix: "12,5" },
    ]);
  });

  it("gère le BOM, les CRLF et les lignes vides", () => {
    expect(parseCsv("﻿titre,prix\r\nJean,10\r\n\r\n")).toEqual([{ titre: "Jean", prix: "10" }]);
  });

  it("accepte un retour à la ligne dans un champ", () => {
    expect(parseCsv('a,b\n"x\ny",2')[0].a).toBe("x\ny");
  });

  it("renvoie vide sans contenu", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("import CSV", () => {
  const row = { titre: "Jean Levis", categorie: "jeans", prix: "30", etat: "Très bon état" };

  it("valide une ligne complète et traduit l'état", () => {
    const [result] = validateCsvRows([row], categories);
    expect(result).toMatchObject({ ok: true, line: 2 });
    if (result.ok) expect(result.product.condition).toBe("very_good");
  });

  it("accepte une catégorie en français ou en arabe", () => {
    expect(validateCsvRows([{ ...row, categorie: "Jeans" }], categories)[0].ok).toBe(true);
    expect(validateCsvRows([{ ...row, categorie: "جينز" }], categories)[0].ok).toBe(true);
  });

  it("signale chaque erreur avec son numéro de ligne", () => {
    const results = validateCsvRows(
      [row, { ...row, prix: "gratuit" }, { ...row, categorie: "inconnue" }, { ...row, etat: "usé" }, { ...row, titre: "" }],
      categories,
    );

    expect(results.map((result) => (result.ok ? "ok" : `${result.line}:${result.error}`))).toEqual([
      "ok",
      "3:priceInvalid",
      "4:categoryUnknown",
      "5:conditionUnknown",
      "6:nameTooShort",
    ]);
  });

  it("reconnaît les états sans tenir compte des accents", () => {
    expect(normalizeCondition("TRÈS BON")).toBe("very_good");
    expect(normalizeCondition("n'importe quoi")).toBeNull();
  });
});

describe("schémas marketplace", () => {
  it("accepte un brouillon vide", () => {
    const empty = {
      title: "", categoryId: "", condition: "", price: "", brand: "", size: "", color: "",
      reference: "", description: "", defects: "",
    };

    expect(productSchema.parse(empty)).toMatchObject({ title: null, price: null, categoryId: null });
  });

  it("borne les filtres du catalogue, même avec une URL trafiquée", () => {
    const filters = catalogFiltersSchema.parse({
      q: ["veste", "autre"], tri: "injection", page: "-3", etat: "neuf-ish",
    });

    expect(filters).toMatchObject({ q: "veste", tri: "recent", page: 1, etat: undefined });
  });

  it("exige une adresse pour la livraison, pas pour le retrait", () => {
    const base = {
      expectedTotal: null,
      productIds: [id], pickupShopIds: [], recipientName: "Lina", phone: "22123456",
      governorateId: "0", cityId: "0", addressLine: "",
    };

    expect(checkoutSchema.safeParse({ ...base, needsAddress: true }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...base, needsAddress: false }).success).toBe(true);
  });

  it("enchaîne les statuts selon le mode de remise", () => {
    expect(nextOrderStatus("preparing", "delivery")).toBe("shipped");
    expect(nextOrderStatus("preparing", "pickup")).toBe("delivered");
    expect(nextOrderStatus("delivered", "delivery")).toBeNull();
    expect(nextOrderStatus("cancelled", "pickup")).toBeNull();
  });
});

describe("reconnaissance automatique", () => {
  it("reste inactive tant qu'aucun modèle n'est branché", () => {
    expect(getGarmentRecognizer()).toBeNull();
  });
});
