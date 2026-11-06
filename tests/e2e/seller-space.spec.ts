import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
import { createApprovedShop, seedProduct } from "./market-helpers";

test("espace vendeur : trois actions, voir ma boutique, retour à l'application", async ({ page }) => {
  const shop = await createApprovedShop();
  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}`);

  const sections = page.getByRole("navigation", { name: "Espace vendeur" });
  for (const name of ["Ma boutique", "Mes produits", "Mes vidéos"]) {
    await expect(sections.getByRole("link", { name })).toBeVisible();
  }
  await expect(sections.getByRole("link", { name: "Ma boutique" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Ajouter un produit" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Créer une vidéo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier les infos et le logo" })).toHaveAttribute("href", /\/reglages$/);

  await sections.getByRole("link", { name: "Mes produits" }).click();
  await expect(page).toHaveURL(/\/produits$/);
  await expect(page.getByRole("navigation", { name: "Mes produits" }).getByRole("link", { name: "Publication rapide" })).toBeVisible();

  await page.getByRole("link", { name: "Voir ma boutique" }).click();
  await expect(page).toHaveURL(new RegExp(`/boutique/${shop.slug}$`));

  await page.goBack();
  await page.getByRole("link", { name: "Retour à l'application" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("ajout de produit : les champs suivent le type de pièce", async ({ page }) => {
  const shop = await createApprovedShop();
  // Trois pièces en ligne dans la catégorie : le prix habituel peut être proposé.
  for (const price of [20000, 30000, 40000]) await seedProduct(shop.id, { price, categorySlug: "baskets" });

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/produits/nouveau`);

  // Chaussures : des pointures, pas de tailles de vêtement.
  await page.getByRole("radiogroup", { name: "Catégorie · Mode" }).getByText("Chaussures", { exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Pointures" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Tailles" })).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Pointures" }).getByText("42", { exact: true }).click();
  await expect(page.locator("#size")).toHaveValue("42");

  // Prix habituel tiré des pièces en ligne de la sous-catégorie.
  await page.getByRole("radiogroup", { name: "Précise" }).getByText("Baskets", { exact: true }).click();
  const hint = page.getByRole("button", { name: /Prix habituel ici/ });
  await expect(hint).toBeVisible();
  await hint.click();
  await expect(page.getByLabel("Prix (DT)")).not.toHaveValue("");

  // Un titre proposé à partir des choix.
  await page.getByRole("radiogroup", { name: "Marques suggérées" }).getByText("Nike", { exact: true }).click();
  await page.getByRole("button", { name: /Titre proposé : Baskets Nike/ }).click();
  await expect(page.getByLabel("Titre")).toHaveValue("Baskets Nike");

  // Objets divers : ni taille, ni couleur, mais les caractéristiques de la rubrique.
  await page.getByRole("button", { name: "Changer de rayon" }).click();
  await page.getByRole("radiogroup", { name: "Catégorie · Marketplace" }).getByText("Électroménager", { exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Catégorie · Mode" })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Pointures" })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Couleurs" })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Classe énergie" })).toBeVisible();

  // Rien n'est perdu après une erreur : le titre reste, l'erreur s'affiche près du prix.
  await page.getByLabel("Prix (DT)").fill("gratuit");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByLabel("Titre")).toHaveValue("Baskets Nike");
  await expect(page.getByRole("alert").first()).toBeVisible();
});

test("arabe : le formulaire produit propose les mêmes choix", async ({ page }) => {
  const shop = await createApprovedShop();
  await signIn(page, shop.owner.email, `/ar/vendeur/boutique/${shop.id}/produits/nouveau`);
  await page.getByRole("radiogroup", { name: "الصنف · الموضة" }).getByText("ملابس سفلية", { exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "المقاسات" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "الألوان" }).getByText("أزرق", { exact: true })).toBeVisible();
});
