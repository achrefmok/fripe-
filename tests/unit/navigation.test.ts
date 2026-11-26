import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { activeUniverse, UNIVERSES } from "@/components/layout/universe-links";
import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("barre des rubriques", () => {
  it("propose Marketplace, Mode et Vide-Dressing, dans cet ordre", () => {
    expect(UNIVERSES.map((universe) => universe.href)).toEqual(["/marketplace", "/catalogue", "/vide-dressing"]);
  });

  it("souligne la rubrique ouverte, fiches comprises", () => {
    expect(activeUniverse("/marketplace")).toBe("marketplace");
    expect(activeUniverse("/catalogue")).toBe("mode");
    expect(activeUniverse("/produit/123")).toBe("mode");
    expect(activeUniverse("/vide-dressing/coup-de-foudre")).toBe("videDressing");
  });

  it("ne souligne rien ailleurs, ni sur une adresse qui commence pareil", () => {
    expect(activeUniverse("/")).toBeNull();
    expect(activeUniverse("/boutiques")).toBeNull();
    expect(activeUniverse("/catalogue-ancien")).toBeNull();
  });

  it("remplace le bandeau de version de test, sans doublon sur l'accueil ni dans l'en-tête", () => {
    expect(read("src/app/[locale]/layout.tsx")).not.toContain("StagingBanner");
    expect(fr).not.toHaveProperty("staging");
    expect(ar).not.toHaveProperty("staging");

    // L'accueil n'a plus sa propre navigation des rubriques.
    expect(read("src/app/[locale]/(public)/page.tsx")).not.toContain("lx-segment");
    // L'en-tête garde ses autres rubriques ; Mode, Marketplace et Vide-Dressing vivent dans la barre.
    const header = read("src/components/layout/site-header.tsx");
    expect(header).toContain("<UniverseNav />");
    expect(header).not.toMatch(/href: "\/(catalogue|marketplace|vide-dressing)"/);
  });
});

describe("essayage sur mobile", () => {
  const button = read("src/features/stylist/tryon/tryon-button.tsx");
  const css = read("src/features/stylist/tryon/tryon.css");

  it("le bouton Fermer est dans l'en-tête fixe, hors de la zone qui défile", () => {
    const head = button.indexOf("vt-dialog__head");
    const close = button.indexOf("<DialogClose");
    const body = button.indexOf("vt-dialog__body");
    expect(button).toContain("showCloseButton={false}");
    expect(head).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(head);
    expect(close).toBeLessThan(body);
  });

  it("la fenêtre tient dans l'écran et seul son corps défile", () => {
    const rule = (selector: string) => css.match(new RegExp(`${selector.replace(/[.]/g, "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";
    expect(rule(".vt-dialog")).toMatch(/max-height: calc\(100dvh/);
    expect(rule(".vt-dialog")).toMatch(/overflow: hidden/);
    expect(rule(".vt-dialog__head")).toMatch(/flex: none/);
    expect(rule(".vt-dialog__body")).toMatch(/overflow-y: auto/);
    expect(rule(".vt-dialog__close")).toMatch(/min-height: 44px/);
  });

  it("le mannequin et la photo sont bornés en hauteur", () => {
    expect(css).toMatch(/\.vt-dialog \.vt-viewport \{[^}]*100dvh/);
    expect(css).toMatch(/\.vt-dialog \.vt-canvas \{[^}]*max-height: calc\(100dvh/);
  });
});
