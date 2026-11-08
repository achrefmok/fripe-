import { expect, test } from "@playwright/test";
import { admin, createAdminUser, signIn } from "./helpers";
import { createApprovedShop, seedProduct, unique } from "./market-helpers";

test("arrivage : la boutique l'annonce, l'administration le valide, il paraît en tête de l'accueil", async ({ page }) => {
  const shop = await createApprovedShop();
  const first = await seedProduct(shop.id, { title: `Veste arrivage ${unique("a")}` });
  const second = await seedProduct(shop.id, { title: `Jean arrivage ${unique("b")}` });
  const title = `Arrivage vestes ${unique("t")}`;

  // 1. La boutique choisit ses pièces en ligne et envoie l'arrivage.
  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/arrivages`);
  await page.getByRole("button", { name: "Envoyer pour validation" }).click();
  await expect(page.getByText("Indique un titre d'au moins 3 caractères.")).toBeVisible();

  await page.getByLabel("Titre de l'arrivage").fill(title);
  await page.getByText(first.title!).click();
  await page.getByText(second.title!).click();
  await expect(page.getByText("2 sur 12")).toBeVisible();
  await page.getByRole("button", { name: "Envoyer pour validation" }).click();
  await expect(page.getByText("Arrivage envoyé : il paraîtra après validation.")).toBeVisible();
  await expect(page.getByText("En attente de validation")).toBeVisible();

  // En attente : invisible sur l'accueil.
  await page.context().clearCookies();
  await page.goto("/");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);

  // 2. L'administration le valide.
  const manager = await createAdminUser();
  await signIn(page, manager.email, "/admin/arrivages");
  await page.getByRole("button", { name: `Valider l'arrivage « ${title} »` }).click();
  await expect(page.getByText("Arrivage validé")).toBeVisible();
  await page.context().clearCookies();

  // 3. En tête de l'accueil, puis sa page avec les pièces.
  await page.goto("/");
  const card = page.getByRole("link", { name: new RegExp(title) });
  await expect(card).toBeVisible();
  await expect(card).toContainText("2 pièces");
  await card.click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(first.title!) })).toBeVisible();

  const { data } = await admin.from("audit_logs").select("action").eq("entity_id", page.url().split("/").pop()!);
  expect(data?.map((row) => row.action).sort()).toEqual(["arrival.approved", "arrival.submitted"]);
});

test("arrivage refusé : le motif est lu par la boutique, rien ne paraît", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id, { title: `Robe arrivage ${unique("r")}` });
  const title = `Arrivage refusé ${unique("t")}`;

  const { data: arrival } = await admin.from("arrivals").insert({ shop_id: shop.id, title }).select("id").single();
  await admin.from("arrival_products").insert({ arrival_id: arrival!.id, product_id: product.id });

  const manager = await createAdminUser();
  await signIn(page, manager.email, "/admin/arrivages");
  await page.getByRole("button", { name: `Refuser l'arrivage « ${title} »` }).click();
  await page.getByLabel("Motif (lu par la boutique)").fill("Photos trop sombres");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByText("Arrivage refusé")).toBeVisible();
  await page.context().clearCookies();

  await page.goto("/");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toHaveCount(0);

  await signIn(page, shop.owner.email, `/vendeur/boutique/${shop.id}/arrivages`);
  await expect(page.getByText("Motif : Photos trop sombres")).toBeVisible();
  await page.getByRole("button", { name: "Retirer" }).click();
  await expect(page.getByText("Arrivage retiré")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test("accueil : AI Stylist et Outfit Builder en tête, boutiques en badges, « Aussi sur FRIPE » en bas", async ({ page }) => {
  await page.goto("/");
  const tools = page.getByRole("navigation", { name: "Composer une tenue" });
  await expect(tools.getByRole("link", { name: /AI Stylist/ })).toHaveAttribute("href", "/stylist");
  await expect(tools.getByRole("link", { name: /Outfit Builder/ })).toHaveAttribute("href", "/tenues/nouvelle");

  // Plus de rangée vidéo ni d'atelier en bas de page.
  await expect(page.getByRole("heading", { name: "En vidéo" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "L'atelier" })).toHaveCount(0);

  // « Aussi sur FRIPE » est la dernière section de l'accueil.
  const headings = await page.locator("main h2").allTextContents();
  expect(headings.at(-1)).toBe("Aussi sur FRIPE");
});
