import { expect, test } from "@playwright/test";

test.describe("Le dressing", () => {
  test("les portes ne bloquent rien et un vêtement ouvre son univers sur l'accueil", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".armoire__doors")).toHaveCSS("pointer-events", "none");

    await page.locator("#armoire-interieur").getByRole("link", { name: "Bas" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("tab", { name: "Bas" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Bas" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 3, name: "Bas" })).toBeVisible();
  });

  test("la porte elle-même ferme et rouvre l'armoire, fermée elle ne se parcourt pas", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".armoire")).toHaveAttribute("data-state", "open");

    // Aucun bouton à côté du dressing : le geste se fait sur la porte.
    await expect(page.locator(".dressing__intro button, .dressing__hint button")).toHaveCount(0);
    await expect(page.locator(".armoire__door--left")).toHaveJSProperty("tagName", "BUTTON");

    await page.getByRole("button", { name: "Fermer le dressing" }).click();
    await expect(page.getByText("Touche la porte pour ouvrir le dressing.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ouvrir le dressing" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#armoire-interieur")).toHaveAttribute("inert", "");

    await page.getByRole("button", { name: "Ouvrir le dressing" }).click();
    await expect(page.getByRole("button", { name: "Fermer le dressing" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#armoire-interieur")).not.toHaveAttribute("inert", "");
  });

  test("les onglets des univers se parcourent au clavier", async ({ page }) => {
    await page.goto("/");

    const first = page.getByRole("tab").first();
    await first.click();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByRole("tab").nth(1)).toBeFocused();
    await expect(page.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(first).toHaveAttribute("tabindex", "-1");
  });

  test("« Tout voir » mène au catalogue dans l'univers choisi", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("tab", { name: "Bas" }).click();
    await page.locator("#univers-panneau").getByRole("link", { name: /Tout voir/ }).click();

    await expect(page).toHaveURL(/categorie=bas/);
    await expect(page.getByRole("heading", { level: 1, name: "Bas" })).toBeVisible();
    await expect(page.locator(".universe-wipe")).toHaveCount(0);
  });

  test("les portes ne rejouent pas au retour sur l'accueil", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".armoire")).toHaveAttribute("data-state", "open");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("fripe-dressing-ouvert"))).toBe("1");

    await page.goto("/");
    await expect(page.locator(".armoire")).toHaveAttribute("data-state", "open");
  });

  test("sans mouvement, l'armoire est ouverte et la navigation est directe", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", locale: "fr-FR" });
    const page = await context.newPage();

    await page.goto("/");
    await expect(page.locator(".armoire__door--left")).toHaveCSS("animation-name", "none");

    await page.locator("#univers-panneau").getByRole("link", { name: /Tout voir/ }).click();
    await expect(page).toHaveURL(/categorie=/);
    await expect(page.locator(".universe-wipe")).toHaveCount(0);

    await context.close();
  });

  test("une catégorie inconnue reste un catalogue ordinaire", async ({ page }) => {
    await page.goto("/catalogue?categorie=inconnue");

    await expect(page.getByRole("heading", { level: 1, name: "Catalogue" })).toBeVisible();
    await expect(page.locator(".universe-band")).toHaveCount(0);
  });

  test("en arabe, le titre et les deux chemins partent de la droite", async ({ page }) => {
    await page.goto("/ar");

    const title = await page.locator(".dressing__title").boundingBox();
    const first = await page.locator(".path").first().boundingBox();
    const width = page.viewportSize()!.width;

    expect(title!.x + title!.width).toBeGreaterThan(width * 0.75);
    // « نحوّس » (Je chine) vient en premier, donc à droite.
    expect(first!.x).toBeGreaterThan(width * 0.4);
  });

  test("les deux chemins ouvrent le catalogue et la vente", async ({ page }) => {
    await page.goto("/");
    const paths = page.getByRole("navigation", { name: "Que veux-tu faire ?" });

    await paths.getByRole("link", { name: /Je chine/ }).click();
    await expect(page).toHaveURL(/\/catalogue$/);

    await page.goto("/");
    await paths.getByRole("link", { name: /Je vends/ }).click();
    await expect(page).toHaveURL(/\/vendre$/);
  });
});
