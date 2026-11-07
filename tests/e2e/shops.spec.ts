import { expect, test } from "@playwright/test";
import {
  admin,
  createAdminUser,
  createConfirmedUser,
  createShopInUi,
  fillShopForm,
  signIn,
} from "./helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("parcours 2 : création de boutique, validation admin, audit", async ({ page }) => {
  const seller = await createConfirmedUser("seller", "Vendeuse Test");
  const name = `Vintage ${Date.now()}`;

  await signIn(page, seller.email);
  await page.goto("/vendeur");
  await expect(page.getByRole("heading", { name: "Ta boutique commence ici" })).toBeVisible();

  const shopId = await createShopInUi(page, name);
  await expect(page.getByText("Ta demande est en cours de vérification.")).toBeVisible();
  await page.context().clearCookies();

  const adminUser = await createAdminUser();
  await signIn(page, adminUser.email, "/admin");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await row.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText("Décision enregistrée")).toBeVisible();

  const { data } = await admin.from("shops").select("status").eq("id", shopId).single();
  expect(data?.status).toBe("approved");

  await page.goto("/admin/audit");
  await expect(page.getByText("shop.approved", { exact: true }).first()).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, seller.email, `/vendeur/boutique/${shopId}`);
  await expect(page.getByText("Ta boutique est validée.")).toBeVisible();
});

test("refus avec motif, puis nouvelle demande", async ({ page }) => {
  const seller = await createConfirmedUser("rejected");
  const name = `Refus ${Date.now()}`;
  await signIn(page, seller.email);
  const shopId = await createShopInUi(page, name);
  await page.context().clearCookies();

  const adminUser = await createAdminUser();
  await signIn(page, adminUser.email, "/admin/boutiques?statut=pending");
  const row = page.getByRole("listitem").filter({ hasText: name });

  await row.getByRole("button", { name: "Refuser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Indique un motif d'au moins 3 caractères.")).toBeVisible();

  await page.getByLabel("Motif communiqué à la boutique").fill("Photos de la boutique manquantes");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Décision enregistrée")).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, seller.email, `/vendeur/boutique/${shopId}`);
  await expect(page.getByText("Photos de la boutique manquantes")).toBeVisible();
  await page.getByRole("button", { name: "Renvoyer ma demande" }).click();
  await expect(page.getByText("Ta demande est en cours de vérification.")).toBeVisible();
});

test("un slug déjà pris est signalé sur le champ", async ({ page }) => {
  const first = await createConfirmedUser("slug");
  const name = `Double ${Date.now()}`;
  await signIn(page, first.email);
  await createShopInUi(page, name);
  await page.context().clearCookies();

  const second = await createConfirmedUser("slug2");
  await signIn(page, second.email);
  await fillShopForm(page, name);
  await expect(page.getByText("Cette adresse est déjà prise.")).toBeVisible();
});

test("un vendeur, une boutique : l'espace vendeur mène droit à elle", async ({ page }) => {
  const seller = await createConfirmedUser("unique");
  await signIn(page, seller.email, "/vendeur");

  // Sans boutique : seule la création est proposée.
  const shell = page.getByRole("navigation", { name: "Espace vendeur" }).first();
  await expect(shell.getByRole("link", { name: "Créer ma boutique" })).toBeVisible();
  await expect(page.getByText("Une seule boutique par compte")).toHaveCount(0);

  const shopId = await createShopInUi(page, `Unique ${Date.now()}`);

  // Avec sa boutique : plus de liste ni de « Nouvelle boutique ».
  await page.goto("/vendeur");
  await expect(page).toHaveURL(new RegExp(`/vendeur/boutique/${shopId}$`));
  await expect(page.getByRole("link", { name: "Nouvelle boutique" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Créer ma boutique" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Espace vendeur" }).first().getByRole("link", { name: "Ma boutique" }).first()).toBeVisible();

  // La page de création renvoie à la boutique existante.
  await page.goto("/vendeur/creer-boutique");
  await expect(page).toHaveURL(new RegExp(`/vendeur/boutique/${shopId}$`));
});

test("modification de la boutique et envoi d'un logo", async ({ page }) => {
  const seller = await createConfirmedUser("logo");
  await signIn(page, seller.email);
  const shopId = await createShopInUi(page, `Logo ${Date.now()}`);

  await page.goto(`/vendeur/boutique/${shopId}/reglages`);
  await page.getByLabel("Description").fill("Spécialiste des vestes vintage");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await expect(page.getByText("Modifications enregistrées")).toBeVisible();

  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: "faux.png", mimeType: "image/png", buffer: Buffer.from("<svg/>") });
  await expect(page.getByText("Choisis une image JPEG, PNG ou WebP.")).toBeVisible();

  await input.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText("Logo mis à jour")).toBeVisible();

  const { data } = await admin
    .from("shops")
    .select("logo_path, description")
    .eq("id", shopId)
    .single();

  expect(data?.logo_path).toMatch(new RegExp(`^${shopId}/logo-\\d+\\.png$`));
  expect(data?.description).toBe("Spécialiste des vestes vintage");

  const logo = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/shop-assets/${data?.logo_path}`,
  );
  expect(logo.status).toBe(200);
});

test("isolation : un autre vendeur n'accède pas à la boutique", async ({ page }) => {
  const owner = await createConfirmedUser("owner");
  await signIn(page, owner.email);
  const name = `Privee ${Date.now()}`;
  const shopId = await createShopInUi(page, name);
  await page.context().clearCookies();

  const other = await createConfirmedUser("other");
  await signIn(page, other.email);
  await page.goto(`/vendeur/boutique/${shopId}`);

  // Le squelette de chargement fait partir la réponse avant le notFound() : le statut HTTP
  // n'est pas significatif ici. Ce qui compte, c'est qu'aucune donnée de la boutique ne sorte.
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
  expect(await page.content()).not.toContain(name);
});

test("un client n'accède pas à l'administration", async ({ page }) => {
  const client = await createConfirmedUser("nonadmin");
  await signIn(page, client.email);
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Rien sur ce cintre" })).toBeVisible();
});

test("suspension d'un compte depuis l'administration", async ({ page }) => {
  const target = await createConfirmedUser("suspended", `Suspect ${Date.now()}`);
  const adminUser = await createAdminUser();

  await signIn(page, adminUser.email, `/admin/utilisateurs?q=${encodeURIComponent(target.email)}`);
  await page.getByRole("button", { name: "Suspendre" }).click();
  await page.getByLabel("Motif interne").fill("Test de suspension");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Décision enregistrée")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réactiver" })).toBeVisible();
  await page.context().clearCookies();

  await signIn(page, target.email);
  await expect(page).toHaveURL(/compte-suspendu/);
  await page.goto("/vendeur/creer-boutique");
  await expect(page).toHaveURL(/compte-suspendu/);
});
