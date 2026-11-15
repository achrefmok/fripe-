import { expect, test } from "@playwright/test";
import { admin, createConfirmedUser, signIn } from "./helpers";
import { clientFor, unique } from "./market-helpers";

async function categoryId(slug: string) {
  const { data } = await admin.from("categories").select("id").eq("slug", slug).single();
  return data!.id as string;
}

async function governorateId() {
  const { data } = await admin.from("cities").select("governorate_id").eq("slug", "la-marsa").single();
  return data!.governorate_id as number;
}

// Un dressing de trois pièces, publiées par la personne elle-même.
async function seedDressing(name: string) {
  const seller = await createConfirmedUser("dressing", name);
  const client = await clientFor(seller.email);
  const [category, governorate] = await Promise.all([categoryId("jeans"), governorateId()]);
  const pieces = [
    { title: `Jean droit ${unique("j")}`, price: 40000, brand: "Levi's", size: "M" },
    { title: `Jean large ${unique("j")}`, price: 25000, brand: null, size: "L" },
    { title: `Jean brut ${unique("j")}`, price: 35000, brand: "Zara", size: "S" },
  ];

  const ids: string[] = [];
  for (const piece of pieces) {
    const { data, error } = await client
      .from("listings")
      .insert({
        section: "vide_dressing",
        category_id: category,
        title: piece.title,
        brand: piece.brand,
        size: piece.size,
        condition: "very_good",
        price_millimes: piece.price,
        governorate_id: governorate,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.push(data.id);
  }

  return { seller, pieces, ids };
}

test("l'accueil du Vide-Dressing : héros, armoire, envies et bascule grille / portant", async ({ page }) => {
  const { pieces } = await seedDressing("Karim Testeur");

  await page.goto("/vide-dressing");
  await expect(page.getByRole("heading", { level: 1, name: /Les dressings/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Les dernières arrivées" })).toBeVisible();

  // L'armoire s'ouvre d'elle-même, puis se referme et se rouvre à la porte.
  const doors = page.getByRole("button", { name: "Ouvrir ou fermer le dressing" });
  if (await doors.count()) {
    await expect(doors).toHaveAttribute("aria-expanded", "true");
    await doors.click();
    await expect(doors).toHaveAttribute("aria-expanded", "false");
    await doors.click();
    await expect(doors).toHaveAttribute("aria-expanded", "true");
  }

  await expect(page.getByRole("heading", { name: "Dressings du jour" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Le tien \?/ })).toBeVisible();

  // La grille, puis le portant ; le choix tient au rechargement.
  const rack = page.getByRole("button", { name: "Portant" });
  await rack.click();
  await expect(rack).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Portant" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Grille" }).click();

  // « Neuf avec étiquette » filtre sur l'état et descend aux pièces.
  await page.getByRole("link", { name: /Neuf avec étiquette/ }).click();
  await expect(page).toHaveURL(/etat=new_with_tags/);

  // La recherche retrouve une pièce du dressing, avec son bouton d'offre.
  await page.goto(`/vide-dressing?q=${encodeURIComponent(pieces[0].title)}`);
  const card = page.locator(".vd-card", { has: page.getByRole("heading", { level: 3, name: pieces[0].title }) });
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: "Faire une offre" })).toHaveAttribute("href", /\/annonce\/[0-9a-f-]{36}#contact$/);
});

test("on compose un lot dans un dressing et on le propose en un seul message", async ({ page }) => {
  test.setTimeout(90_000);
  const { seller, pieces } = await seedDressing("Sarra Lot");
  const sellerId = seller.id;
  const buyer = await createConfirmedUser("acheteur", "Lina Acheteuse");

  await signIn(page, buyer.email, `/vide-dressing/dressing/${sellerId}`);
  await expect(page.getByRole("heading", { level: 1, name: /Le dressing de Sarra/ })).toBeVisible();
  await expect(page.getByText("pièces en vente")).toBeVisible();

  const propose = page.getByRole("button", { name: "Proposer ce lot à Sarra" });
  await expect(propose).toBeDisabled();

  await page.getByRole("button", { name: `Ajouter ${pieces[0].title} au lot` }).click();
  await expect(page.getByText("Ajoute une autre pièce pour proposer un prix de lot.")).toBeVisible();
  await page.getByRole("button", { name: `Ajouter ${pieces[1].title} au lot` }).click();
  await expect(page.getByText("2 pièces : propose ton prix pour l'ensemble.")).toBeVisible();
  await expect(page.getByRole("button", { name: `Retirer ${pieces[0].title} du lot` }).first()).toBeVisible();

  // 65 DT affichés, 55 DT proposés.
  await page.getByLabel("Ton prix pour le lot (DT)").fill("55");
  await expect(page.getByText(/Tu proposes 10 DT de moins/)).toBeVisible();

  await propose.click();
  await expect(page).toHaveURL(/\/compte\/echanges\/[0-9a-f-]{36}/);
  await expect(page.getByText(pieces[0].title, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/Je te propose 55 DT pour le lot/)).toBeVisible();
});

test("Coup de foudre : on passe, on garde, et l'écran de fin arrive", async ({ page }) => {
  await seedDressing("Ines Foudre");
  const buyer = await createConfirmedUser("foudre", "Nour Foudre");

  await signIn(page, buyer.email, "/vide-dressing/coup-de-foudre");
  await expect(page.getByRole("heading", { level: 1, name: /Coup de foudre/ })).toBeVisible();
  const progress = page.getByText(/^1 \/ \d pièces du jour$/);
  await expect(progress).toBeVisible();
  const total = Number((await progress.textContent())!.match(/\/ (\d)/)![1]);

  await page.getByRole("button", { name: "Coup de cœur" }).click();
  await expect(page.getByLabel("1 coup de cœur")).toBeVisible();

  for (let index = 1; index < total; index += 1) {
    await page.getByRole("button", { name: "Passer" }).click();
  }

  await expect(page.getByRole("heading", { name: /C'est tout/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir mes favoris" })).toBeVisible();

  const { count } = await admin.from("listing_favorites").select("listing_id", { count: "exact", head: true }).eq("user_id", buyer.id);
  expect(count).toBe(1);
});
