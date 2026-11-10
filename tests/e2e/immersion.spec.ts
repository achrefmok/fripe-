import { expect, test } from "@playwright/test";

test.describe("Le dressing en arche", () => {
  test("un vêtement de l'arche ouvre sa catégorie dans le catalogue", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".arch")).toHaveAttribute("data-state", "open");

    await page.locator("#armoire-interieur").getByRole("link", { name: "Bas" }).click();

    await expect(page).toHaveURL(/\/catalogue\?categorie=bas/);
    await expect(page.getByRole("heading", { level: 1, name: "Bas" })).toBeVisible();
  });

  test("la porte elle-même ferme et rouvre l'arche, fermée elle ne se parcourt pas", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".arch")).toHaveAttribute("data-state", "open");

    // Le geste se fait sur la porte ; seule la porte gauche est annoncée.
    await expect(page.locator(".arch__door--left")).toHaveJSProperty("tagName", "BUTTON");
    await expect(page.locator(".arch__door--right")).toHaveAttribute("aria-hidden", "true");

    await page.getByRole("button", { name: "Fermer le dressing" }).click();
    await expect(page.getByText("Touche la porte pour ouvrir le dressing.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ouvrir le dressing" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#armoire-interieur")).toHaveAttribute("inert", "");

    await page.getByRole("button", { name: "Ouvrir le dressing" }).click();
    await expect(page.getByRole("button", { name: "Fermer le dressing" })).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#armoire-interieur")).not.toHaveAttribute("inert", "");
  });

  test("les portes ne rejouent pas au retour sur l'accueil", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".arch")).toHaveAttribute("data-state", "open");
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("fripe-dressing-ouvert"))).toBe("1");

    await page.goto("/");
    await expect(page.locator(".arch")).toHaveAttribute("data-state", "open");
  });

  test("sans mouvement, l'arche est ouverte d'emblée", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", locale: "fr-FR" });
    const page = await context.newPage();

    await page.goto("/");
    await expect(page.locator(".arch__door--left")).toHaveCSS("animation-name", "none");
    await expect(page.locator("#armoire-interieur").getByRole("link").first()).toBeVisible();

    await context.close();
  });

  test("une catégorie inconnue reste un catalogue ordinaire", async ({ page }) => {
    await page.goto("/catalogue?categorie=inconnue");

    await expect(page.getByRole("heading", { level: 1, name: "Tout le catalogue" })).toBeVisible();
  });

  test("en arabe, le titre de l'accueil part de la droite", async ({ page }) => {
    await page.goto("/ar");

    const title = await page.locator("#accueil-titre").boundingBox();
    const width = page.viewportSize()!.width;

    expect(title!.x + title!.width).toBeGreaterThan(width * 0.6);
  });

  test("« Je chine » et « Je vends » ouvrent le catalogue et la page vendre", async ({ page }) => {
    await page.goto("/");
    const paths = page.getByRole("navigation", { name: "Chiner ou vendre" });

    await paths.getByRole("link", { name: "Je chine" }).click();
    await expect(page).toHaveURL(/\/catalogue$/);

    await page.goto("/");
    await paths.getByRole("link", { name: "Je vends" }).click();
    await expect(page).toHaveURL(/\/vendre$/);
  });

  test("le portant et la cabine mènent à Chine et à l'Outfit Builder ; l'atelier à l'AI Stylist", async ({ page }) => {
    await page.goto("/");
    const duo = page.getByRole("region", { name: "Chiner autrement" });

    await duo.getByRole("link", { name: /Le portant à chiner/ }).click();
    await expect(page).toHaveURL(/\/chine$/);

    await page.goto("/");
    await duo.getByRole("link", { name: /La cabine d'essayage/ }).click();
    await expect(page).toHaveURL(/\/tenues\/nouvelle$/);

    await page.goto("/");
    await page.getByRole("region", { name: "L'atelier" }).getByRole("link", { name: /AI Stylist/ }).click();
    await expect(page).toHaveURL(/\/stylist$/);
  });
});
