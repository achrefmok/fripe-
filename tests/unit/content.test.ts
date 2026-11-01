import { describe, expect, it } from "vitest";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";
import legalAr from "@/features/legal/content/ar.json";
import legalFr from "@/features/legal/content/fr.json";
import { rpcFailure } from "@/lib/utils/action-result";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

describe("traductions", () => {
  it("le français et l'arabe ont exactement les mêmes clés", () => {
    expect(keys(ar).sort()).toEqual(keys(fr).sort());
  });
});

describe("pages légales", () => {
  it("les deux langues ont les mêmes pages et les mêmes sections", () => {
    const shape = (content: typeof legalFr) =>
      Object.entries(content.pages).map(([slug, page]) => [slug, page.sections.map((section) => section.body.length)]);

    expect(shape(legalAr as typeof legalFr)).toEqual(shape(legalFr));
  });

  it("chaque information à valider existe dans les deux langues", () => {
    const count = (content: unknown) => JSON.stringify(content).match(/\[\[/g)?.length ?? 0;

    expect(count(legalAr)).toBe(count(legalFr));
    expect(count(legalFr)).toBeGreaterThan(20);
  });
});

describe("erreurs métier", () => {
  it.each([
    "blocked",
    "product_locked",
    "price_changed",
    "invalid_parent",
    "invalid_decision",
    "review_not_allowed",
    "invalid_rating",
    "already_reviewed",
    "already_replied",
    "account_has_active_orders",
  ])("%s est transmis et traduit", (code) => {
    expect(rpcFailure({ message: code }).error).toBe(code);
    expect(Object.keys(fr.errors)).toContain(code);
    expect(Object.keys(ar.errors)).toContain(code);
  });
});
