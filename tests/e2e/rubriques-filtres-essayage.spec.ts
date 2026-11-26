import { expect, test } from "@playwright/test";
import { admin } from "./helpers";
import { createApprovedShop, seedProduct, unique } from "./market-helpers";

test.describe("barre des rubriques", () => {
  test("remplace le bandeau de test, sur toutes les pages publiques, sans doublon sur l'accueil", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Version de test.")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Rubriques" })).toHaveCount(1);

    for (const [path, active] of [
      ["/catalogue", "Mode"],
      ["/marketplace", "Marketplace"],
      ["/vide-dressing", "Vide-Dressing"],
    ] as const) {
      await page.goto(path);
      const rubriques = page.getByRole("navigation", { name: "Rubriques" });
      await expect(rubriques).toHaveCount(1);
      await expect(rubriques.getByRole("link", { name: active })).toHaveAttribute("aria-current", "page");
      for (const name of ["Mode", "Marketplace", "Vide-Dressing"]) {
        await expect(rubriques.getByRole("link", { name })).toBeVisible();
      }
    }

    await page.getByRole("navigation", { name: "Rubriques" }).getByRole("link", { name: "Mode" }).click();
    await expect(page).toHaveURL(/\/catalogue$/);
  });

  test("arabe : la barre est en RTL et traduite", async ({ page }) => {
    await page.goto("/ar/catalogue");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const rubriques = page.getByRole("navigation", { name: "الأقسام" });
    await expect(rubriques.getByRole("link", { name: "سلع متنوعة" })).toBeVisible();
    await expect(rubriques.getByRole("link", { name: "الموضة" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("filtre Femme, Homme, Enfant", () => {
  test("le catalogue Mode filtre par public, les pièces mixtes allant aux adultes", async ({ page }) => {
    const shop = await createApprovedShop();
    const tag = unique("pour");
    const pieces: Record<string, string> = {};

    for (const genre of ["femme", "homme", "mixte", "enfant"]) {
      const product = await seedProduct(shop.id, { title: `Jean ${tag} ${genre}`, categorySlug: "jeans" });
      await admin.from("products").update({ attributes: { genre } }).eq("id", product.id);
      pieces[genre] = product.title!;
    }

    const expectOnly = async (visible: string[]) => {
      for (const [genre, title] of Object.entries(pieces)) {
        await expect(page.getByText(title)).toHaveCount(visible.includes(genre) ? 1 : 0);
      }
    };

    await page.goto(`/catalogue?q=${tag}`);
    await expectOnly(["femme", "homme", "mixte", "enfant"]);

    const audience = page.getByRole("navigation", { name: "Pour qui" });
    await audience.getByRole("link", { name: "Homme" }).click();
    await expect(page).toHaveURL(/pour=homme/);
    await expectOnly(["homme", "mixte"]);

    await page.getByRole("navigation", { name: "Pour qui" }).getByRole("link", { name: "Enfant" }).click();
    await expectOnly(["enfant"]);

    await page.goto(`/catalogue?q=${tag}&pour=femme`);
    await expectOnly(["femme", "mixte"]);

    // Une valeur inconnue est ignorée : tout reste affiché.
    await page.goto(`/catalogue?q=${tag}&pour=inconnu`);
    await expectOnly(["femme", "homme", "mixte", "enfant"]);
  });

  test("le Vide-Dressing propose le même filtre", async ({ page }) => {
    await page.goto("/vide-dressing?pour=femme");
    const audience = page.getByRole("navigation", { name: "Pour qui" });
    await expect(audience.getByRole("link", { name: "Femme" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /Retirer le filtre/ }).filter({ hasText: "Femme" })).toBeVisible();
  });
});

test.describe("essayage sur mobile", () => {
  test("le vêtement ne recouvre plus l'écran et le bouton Fermer reste accessible", async ({ page }) => {
    const shop = await createApprovedShop();
    await seedProduct(shop.id, { title: `Haut ${unique("e")}`, categorySlug: "t-shirts" });
    await seedProduct(shop.id, { title: `Jean ${unique("e")}`, categorySlug: "jeans" });

    for (const size of [{ width: 320, height: 568 }, { width: 390, height: 664 }]) {
      await page.setViewportSize(size);
      await page.goto("/tenues/nouvelle");
      await page.getByRole("button", { name: "Au hasard" }).click();
      await page.getByRole("button", { name: "Essayer la tenue" }).click();

      const dialog = page.getByTestId("tryon-dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Femme" }).click();

      const box = await dialog.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);

      const close = dialog.getByRole("button", { name: "Fermer" });
      await expect(close).toBeInViewport();

      // Le corps défile, l'en-tête et son bouton Fermer restent en place.
      await dialog.locator(".vt-dialog__body").evaluate((body) => body.scrollTo(0, body.scrollHeight));
      await expect(close).toBeInViewport();

      await close.click();
      await expect(dialog).toHaveCount(0);
    }
  });
});
