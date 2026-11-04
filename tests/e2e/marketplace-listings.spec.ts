import { expect, test, type Page } from "@playwright/test";
import { admin, createConfirmedUser, signIn } from "./helpers";
import { clientFor, createApprovedShop, PNG, seedProduct, unique } from "./market-helpers";

async function categoryId(slug: string) {
  const { data } = await admin.from("categories").select("id").eq("slug", slug).single();
  return data!.id as string;
}

async function governorateId() {
  const { data } = await admin.from("cities").select("governorate_id").eq("slug", "la-marsa").single();
  return data!.governorate_id as number;
}

// Une annonce publiée par son vendeur, comme depuis l'application.
async function seedListing(
  email: string,
  overrides: { section?: "marketplace" | "vide_dressing"; title?: string; category?: string; price?: number; attributes?: Record<string, string> } = {},
) {
  const seller = await clientFor(email);
  const { data, error } = await seller
    .from("listings")
    .insert({
      section: overrides.section ?? "marketplace",
      category_id: await categoryId(overrides.category ?? "velos"),
      title: overrides.title ?? `Annonce ${unique("a")}`,
      condition: "good",
      price_millimes: overrides.price ?? 120000,
      governorate_id: await governorateId(),
      attributes: overrides.attributes ?? {},
    })
    .select("id, title")
    .single();

  if (error) throw error;
  return data;
}

async function expectListed(page: Page, path: string, title: string, visible: boolean) {
  await page.goto(path);
  const card = page.getByRole("heading", { level: 3, name: title });
  if (visible) await expect(card).toBeVisible();
  else await expect(card).toHaveCount(0);
}

test("un particulier publie une annonce avec photo, visible dans la Marketplace et nulle part ailleurs", async ({ page }) => {
  test.setTimeout(90_000);
  const seller = await createConfirmedUser("perso", "Samia Vendeuse");
  const title = `Vélo de ville ${unique("v")}`;

  await signIn(page, seller.email, "/compte/annonces/nouvelle?rubrique=marketplace");
  await page.getByLabel("Titre").fill(title);
  await page.getByLabel("Catégorie").selectOption({ label: "Vélos" });
  await page.getByLabel("Type").selectOption({ label: "Ville" });
  await page.getByLabel("État").selectOption("good");
  await page.getByLabel("Prix (DT)").fill("180");
  await page.getByLabel("Gouvernorat").selectOption({ label: "Tunis" });
  await page.getByRole("button", { name: "Publier et ajouter les photos" }).click();

  await expect(page).toHaveURL(/\/compte\/annonces\/[0-9a-f-]{36}/);
  await page.getByLabel("Ajouter des photos").setInputFiles({ name: "velo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Retirer la photo" })).toHaveCount(1);

  await expectListed(page, `/marketplace?q=${encodeURIComponent(title)}`, title, true);
  await expect(page.getByText(/Particulier · Samia/)).toBeVisible();
  await expectListed(page, `/vide-dressing?q=${encodeURIComponent(title)}`, title, false);
  await page.goto(`/catalogue?q=${encodeURIComponent(title)}`);
  await expect(page.getByText(title)).toHaveCount(0);

  await page.goto("/compte/annonces");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("le Vide-Dressing reste à la mode des particuliers", async ({ page }) => {
  const seller = await createConfirmedUser("dressing");
  const dressing = await seedListing(seller.email, { section: "vide_dressing", category: "jeans", title: `Jean taille haute ${unique("j")}` });

  await expectListed(page, `/vide-dressing?q=${encodeURIComponent(dressing.title)}`, dressing.title, true);
  await expectListed(page, `/marketplace?q=${encodeURIComponent(dressing.title)}`, dressing.title, false);
  await page.goto(`/catalogue?q=${encodeURIComponent(dressing.title)}`);
  await expect(page.getByText(dressing.title)).toHaveCount(0);

  const seller2 = await clientFor(seller.email);
  const { error } = await seller2.from("listings").insert({
    section: "vide_dressing",
    category_id: await categoryId("refrigerateurs"),
    title: "Frigo dans le dressing",
    condition: "good",
    price_millimes: 1000,
    governorate_id: await governorateId(),
  });
  expect(error?.message).toBe("invalid_category");
});

test("les filtres suivent la catégorie : type de vélo, prix et vendeur", async ({ page }) => {
  const seller = await createConfirmedUser("filtres");
  const marker = unique("f");
  const vtt = await seedListing(seller.email, { title: `VTT ${marker}`, attributes: { type_velo: "vtt" }, price: 300000 });
  const route = await seedListing(seller.email, { title: `Route ${marker}`, attributes: { type_velo: "route" }, price: 900000 });

  await page.goto(`/marketplace?categorie=velos&q=${marker}`);
  await expect(page.getByRole("heading", { level: 1, name: "Vélos" })).toBeVisible();
  await page.getByRole("button", { name: /Filtres/ }).click();
  await expect(page.getByRole("dialog", { name: "Filtrer les annonces" })).toBeVisible();
  await page.getByLabel("Type").selectOption({ label: "VTT" });
  await page.getByRole("button", { name: "Voir les résultats" }).click();

  await expect(page.getByRole("heading", { level: 3, name: vtt.title })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: route.title })).toHaveCount(0);

  await expectListed(page, `/marketplace?q=${marker}&prixMax=500`, vtt.title, true);
  await expect(page.getByRole("heading", { level: 3, name: route.title })).toHaveCount(0);
  await expectListed(page, `/marketplace?q=${marker}&vendeur=pro`, vtt.title, false);
});

test("acheteur et vendeur échangent, personne d'autre ne lit", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const seller = await createConfirmedUser("vend", "Karim Vendeur");
  const buyer = await createConfirmedUser("achat", "Ines Acheteuse");
  const stranger = await createConfirmedUser("intrus");
  const listing = await seedListing(seller.email, { category: "chaises", title: `Chaises en bois ${unique("c")}` });

  await signIn(page, buyer.email, `/annonce/${listing.id}`);
  await page.getByLabel("Écrire au vendeur").fill("Bonjour, je peux passer samedi ?");
  await page.getByRole("button", { name: "Envoyer le message" }).click();
  await expect(page).toHaveURL(/\/compte\/echanges\/[0-9a-f-]{36}/);
  await expect(page.getByText("Bonjour, je peux passer samedi ?")).toBeVisible();
  const threadUrl = page.url();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await signIn(sellerPage, seller.email, "/compte/notifications");
  await expect(sellerPage.getByText(`Nouveau message à propos de « ${listing.title} »`)).toBeVisible();
  await sellerPage.goto("/compte/echanges");
  await sellerPage.getByRole("link", { name: /Ines Acheteuse/ }).click();
  await sellerPage.getByLabel("Message").fill("Oui, samedi matin.");
  await sellerPage.getByRole("button", { name: "Envoyer" }).click();
  await expect(sellerPage.getByText("Oui, samedi matin.")).toBeVisible();
  await sellerContext.close();

  await page.reload();
  await expect(page.getByText("Oui, samedi matin.")).toBeVisible();

  const strangerContext = await browser.newContext();
  const strangerPage = await strangerContext.newPage();
  await signIn(strangerPage, stranger.email, "/compte");
  const response = await strangerPage.goto(new URL(threadUrl).pathname);
  expect(response?.status()).toBe(404);
  await strangerContext.close();
});

test("vendue, l'annonce quitte la Marketplace ; supprimée, elle disparaît", async ({ page }) => {
  const seller = await createConfirmedUser("solde");
  const listing = await seedListing(seller.email, { category: "tables", title: `Table basse ${unique("t")}` });

  await signIn(page, seller.email, `/annonce/${listing.id}`);
  await expect(page.getByText("C'est ton annonce")).toBeVisible();
  await page.getByRole("button", { name: "Marquer vendue" }).click();
  await expect(page.getByText("Cette annonce est vendue.")).toBeVisible();
  await expectListed(page, `/marketplace?q=${encodeURIComponent(listing.title)}`, listing.title, false);

  await page.goto("/compte/annonces");
  await page.getByRole("button", { name: "Supprimer" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
  // Tant que la confirmation est ouverte, la liste est masquée : on attend sa fermeture.
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("link", { name: listing.title })).toHaveCount(0);

  await expect
    .poll(async () => (await admin.from("listings").select("id", { count: "exact", head: true }).eq("id", listing.id)).count)
    .toBe(0);
});

test("une boutique vend aussi dans la Marketplace, sans toucher au catalogue mode", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Télévision ${unique("tv")}`, categorySlug: "televisions" });

  await expectListed(page, `/marketplace?q=${encodeURIComponent(product.title!)}`, product.title!, true);
  await expect(page.getByText(shop.name).first()).toBeVisible();
  await page.goto(`/catalogue?q=${encodeURIComponent(product.title!)}`);
  await expect(page.getByText(product.title!)).toHaveCount(0);
});

test("mobile : trois rubriques et la vente dans la barre du bas", async ({ page }) => {
  await page.goto("/");
  const tabbar = page.getByRole("navigation", { name: "Navigation principale" }).last();
  for (const name of ["Mode", "Marketplace", "Vendre", "Vide-Dressing", "Compte"]) {
    await expect(tabbar.getByRole("link", { name })).toBeVisible();
  }

  await tabbar.getByRole("link", { name: "Marketplace" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Marketplace" })).toBeVisible();
  await expect(tabbar.getByRole("link", { name: "Marketplace" })).toHaveAttribute("aria-current", "page");

  await tabbar.getByRole("link", { name: "Vendre" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Que veux-tu vendre ?" })).toBeVisible();
});
