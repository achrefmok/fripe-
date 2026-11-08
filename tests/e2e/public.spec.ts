import { expect, test } from "@playwright/test";

test("l'accueil affiche le message et les actions en français", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { level: 1, name: "Chaque pièce a déjà une histoire. Trouve la suivante." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Je chine/ })).toHaveAttribute("href", "/catalogue");
  await expect(page.getByRole("link", { name: /Je vends/ })).toHaveAttribute("href", "/vendre");
  // Les outils restent présents, réunis dans l'atelier.
  for (const name of [/AI Stylist/, /Outfit Builder/, /Fripe Walk/]) {
    await expect(page.getByRole("region", { name: "L'atelier" }).getByRole("link", { name })).toBeAttached();
  }
});

test("l'arabe s'affiche en RTL, et la langue se change depuis l'en-tête", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Passer en arabe" }).click();
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("link", { name: /نبيع/ })).toBeAttached();
});

test("le thème sombre se choisit et persiste au rechargement", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: "Changer de thème" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("une page inconnue répond 404 avec une page FRIPE", async ({ page }) => {
  const response = await page.goto("/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
});

test("les en-têtes de sécurité sont présents", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});
