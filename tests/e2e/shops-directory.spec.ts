import { expect, test } from "@playwright/test";
import { admin } from "./helpers";
import { createApprovedShop, seedProduct } from "./market-helpers";

test("annuaire des boutiques : vitrine, recherche par nom, filtre par gouvernorat", async ({ page }) => {
  const tunis = await createApprovedShop("la-marsa");
  const sfax = await createApprovedShop("sfax-ville");
  await admin.from("shops").update({ description: "Jeans et vestes des années 90." }).eq("id", tunis.id);
  await seedProduct(tunis.id);
  await seedProduct(tunis.id);

  // Recherche par nom : la vitrine montre la ville, les pièces en ligne et la description.
  await page.goto(`/boutiques?q=${encodeURIComponent(tunis.slug)}`);
  const tile = page.getByRole("link", { name: new RegExp(tunis.name) });
  await expect(tile).toBeVisible();
  await expect(tile).toContainText("La Marsa, Tunis");
  await expect(tile).toContainText("2 pièces en ligne");
  await expect(tile).toContainText("Jeans et vestes des années 90.");
  await expect(page.getByRole("status").filter({ hasText: "1 boutique" })).toBeVisible();

  // Une boutique sans pièce n'affiche pas un trou, mais une vitrine en préparation.
  await page.goto(`/boutiques?q=${encodeURIComponent(sfax.slug)}`);
  await expect(page.getByRole("link", { name: new RegExp(sfax.name) })).toContainText("pas encore de pièce en ligne");

  // Le filtre par gouvernorat passe par un formulaire GET : il marche sans JavaScript.
  const { data: place } = await admin.from("shops").select("governorate_id").eq("id", sfax.id).single();
  await page.goto("/boutiques");
  await page.getByLabel("Nom de la boutique").fill(sfax.slug);
  await page.getByLabel("Gouvernorat").selectOption(String(place!.governorate_id));
  await page.getByRole("button", { name: "Afficher" }).click();
  await expect(page).toHaveURL(/gouvernorat=/);
  await expect(page.getByRole("link", { name: new RegExp(sfax.name) })).toBeVisible();

  await page.getByLabel("Nom de la boutique").fill(tunis.slug);
  await page.getByRole("button", { name: "Afficher" }).click();
  await expect(page.getByRole("heading", { name: "Aucune boutique ne correspond" })).toBeVisible();

  // Rien ne correspond : un seul chemin de retour.
  await page.goto("/boutiques?q=aucune-boutique-de-ce-nom");
  await expect(page.getByRole("heading", { name: "Aucune boutique ne correspond" })).toBeVisible();
  await page.getByRole("link", { name: "Voir toutes les boutiques" }).click();
  await expect(page).toHaveURL(/\/boutiques$/);
});
