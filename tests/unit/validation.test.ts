import { describe, expect, it } from "vitest";
import { reviewShopSchema, userStatusSchema } from "@/features/admin/schemas";
import { profileSchema, signUpSchema } from "@/features/auth/schemas";
import { createShopSchema } from "@/features/shops/schemas";
import { normalizeTunisianPhone } from "@/lib/validations/common";

const validShop = {
  name: "Vintage Sfax",
  slug: "vintage-sfax",
  description: "",
  phone: "",
  governorateId: "17",
  cityId: "53",
};

describe("normalizeTunisianPhone", () => {
  it.each([
    ["22 123 456", "+21622123456"],
    ["+216 22123456", "+21622123456"],
    ["0021622123456", "+21622123456"],
    ["98.123.456", "+21698123456"],
  ])("normalise %s", (input, expected) => {
    expect(normalizeTunisianPhone(input)).toBe(expected);
  });

  it.each(["123", "12345678", "221234567", "+33612345678"])("refuse %s", (input) => {
    expect(normalizeTunisianPhone(input)).toBeNull();
  });
});

describe("schémas", () => {
  it("accepte un téléphone déjà normalisé (idempotence)", () => {
    const result = profileSchema.parse({ displayName: "Lina", phone: "+21622123456", locale: "ar" });
    expect(result.phone).toBe("+21622123456");
  });

  it("convertit un téléphone vide en null", () => {
    expect(profileSchema.parse({ displayName: "Lina", phone: " ", locale: "fr" }).phone).toBeNull();
  });

  it("refuse un mot de passe court", () => {
    const result = signUpSchema.safeParse({ displayName: "Lina", email: "l@x.tn", password: "1234" });
    expect(result.success).toBe(false);
  });

  it("accepte une boutique valide et convertit les identifiants", () => {
    const result = createShopSchema.parse(validShop);
    expect(result.governorateId).toBe(17);
    expect(result.cityId).toBe(53);
  });

  it.each(["Ab", "avec espace", "-debut", "fin-", "double--tiret", "ÉTÉ"])(
    "refuse le slug %s",
    (slug) => {
      expect(createShopSchema.safeParse({ ...validShop, slug }).success).toBe(false);
    },
  );

  it("exige un gouvernorat et une ville", () => {
    const result = createShopSchema.safeParse({ ...validShop, governorateId: "", cityId: "" });
    expect(result.success).toBe(false);
  });

  it("exige un motif pour refuser une boutique, pas pour l'approuver", () => {
    const shopId = "7f1f8a5e-3c55-4f54-9d30-0a5a4f1f4a11";
    expect(reviewShopSchema.safeParse({ shopId, status: "rejected", note: "" }).success).toBe(false);
    expect(reviewShopSchema.safeParse({ shopId, status: "approved", note: "" }).success).toBe(true);
  });

  it("exige un motif pour suspendre un compte", () => {
    const userId = "7f1f8a5e-3c55-4f54-9d30-0a5a4f1f4a11";
    expect(userStatusSchema.safeParse({ userId, status: "suspended", reason: "" }).success).toBe(false);
    expect(userStatusSchema.safeParse({ userId, status: "active", reason: "" }).success).toBe(true);
  });
});
