import { describe, expect, it } from "vitest";
import { signInSchema } from "@/features/auth/schemas";
import { rpcFailure, validationFailure } from "@/lib/utils/action-result";
import { formatDate, formatDateTime, localizedName } from "@/lib/utils/format";
import { detectImageKind } from "@/lib/utils/image-file";
import { safeInternalPath } from "@/lib/utils/safe-path";
import { slugify } from "@/lib/utils/slug";

describe("safeInternalPath", () => {
  it("conserve un chemin interne", () => {
    expect(safeInternalPath("/vendeur/boutique/1")).toBe("/vendeur/boutique/1");
  });

  it.each(["https://evil.tn", "//evil.tn", "/\\evil.tn", "javascript:alert(1)", undefined, ["/a"]])(
    "refuse %s",
    (value) => {
      expect(safeInternalPath(value)).toBe("/compte");
    },
  );
});

describe("slugify", () => {
  it("retire accents et ponctuation", () => {
    expect(slugify("Fripe d'Été — Sfax !")).toBe("fripe-d-ete-sfax");
  });

  it("laisse vide un nom sans caractère latin", () => {
    expect(slugify("فريب")).toBe("");
  });

  it("borne la longueur sans tiret final", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("detectImageKind", () => {
  it("reconnaît JPEG, PNG et WebP par leur signature", () => {
    expect(detectImageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(
      detectImageKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime,
    ).toBe("image/png");
    expect(
      detectImageKind(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))
        ?.mime,
    ).toBe("image/webp");
  });

  it("refuse un SVG ou un HTML déguisé", () => {
    expect(detectImageKind(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageKind(new TextEncoder().encode("<html>"))).toBeNull();
  });
});

describe("erreurs d'action", () => {
  it("laisse passer les codes métier connus", () => {
    expect(rpcFailure({ message: "slug_taken" }).error).toBe("slug_taken");
  });

  it("masque les erreurs SQL inconnues", () => {
    const result = rpcFailure({ message: 'relation "x" does not exist', code: "42P01" });
    expect(result.error).toBe("unexpected");
  });

  it("indexe les erreurs de validation par champ", () => {
    const parsed = signInSchema.safeParse({ email: "nope", password: "x" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(validationFailure(parsed.error).fields).toEqual({ email: "emailInvalid" });
    }
  });
});

describe("formatage", () => {
  it("garde les chiffres latins en arabe tunisien", () => {
    expect(formatDate("2026-10-30T12:00:00Z", "ar")).toMatch(/2026/);
  });

  it("affiche l'heure sur 24 heures, à l'heure de Tunis", () => {
    expect(formatDateTime("2026-10-30T18:44:00Z", "fr")).toContain("19:44");
  });

  it("choisit le nom selon la langue", () => {
    expect(localizedName({ name_fr: "Sfax", name_ar: "صفاقس" }, "ar")).toBe("صفاقس");
  });
});
