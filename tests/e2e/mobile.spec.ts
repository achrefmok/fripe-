import { expect, test, type Page } from "@playwright/test";
import { admin, createAdminUser, createConfirmedUser, signIn } from "./helpers";
import { clientFor, createApprovedShop, seedProduct } from "./market-helpers";

// Navigateur Chromium automatisé, à 320 et 360 px : ces tests ne remplacent pas un vrai téléphone.
// Les essais à faire à la main sont décrits dans docs/essais-manuels-mobile.md.
const WIDTHS = [320, 360];

async function auditPage(page: Page, path: string) {
  // Le cookie de langue redirigerait sinon les pages françaises vers leur version arabe.
  await page.context().clearCookies({ name: "NEXT_LOCALE" });
  await page.goto(path, { waitUntil: "load" });

  const report = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;

    const offscreen = [...document.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [role=button]")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) return false;
        if (element.closest(".rail-scroll, [data-scroll-x], nav")) return false;
        if (getComputedStyle(element).visibility === "hidden") return false;
        return box.right > viewport + 1 || box.left < -1;
      })
      .map((element) => element.textContent?.trim().slice(0, 40) || element.tagName);

    return { overflow: document.documentElement.scrollWidth - viewport, offscreen };
  });

  expect.soft(report.overflow, `débordement ${path}`).toBeLessThanOrEqual(0);
  expect.soft(report.offscreen, `hors écran ${path}`).toEqual([]);
}

async function auditAll(page: Page, paths: string[]) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 640 });

    for (const path of paths) {
      await auditPage(page, path);
      await auditPage(page, `/ar${path}`);
    }
  }
}

test.describe.configure({ timeout: 300_000 });

test("pages publiques à 320 et 360 px, français et arabe", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);

  await auditAll(page, [
    "/",
    "/catalogue",
    "/boutiques",
    `/produit/${product.id}`,
    `/boutique/${shop.slug}`,
    "/stylist",
    "/tenues/nouvelle",
    "/connexion",
    "/inscription",
    "/cgv",
    "/confidentialite",
  ]);
});

test("espace client à 320 et 360 px, français et arabe", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  const client = await createConfirmedUser("mobile");
  const buyer = await clientFor(client.email);

  await admin.from("cart_items").insert({ user_id: client.id, product_id: product.id });

  const { data: conversationId } = await buyer.rpc("start_conversation", {
    p_shop_id: shop.id,
    p_product_id: null,
    p_request_id: null,
    p_body: "Un message pour afficher le fil",
  });

  await signIn(page, client.email);

  await auditAll(page, [
    "/compte",
    "/panier",
    "/commande",
    "/compte/commandes",
    "/compte/messages",
    `/compte/messages/${conversationId}`,
    "/compte/blocages",
    "/compte/profil",
  ]);
});

test("espace vendeur à 320 px, français et arabe", async ({ page }) => {
  const shop = await createApprovedShop();
  await seedProduct(shop.id);

  await signIn(page, shop.owner.email);
  await page.setViewportSize({ width: 320, height: 640 });

  const base = `/vendeur/boutique/${shop.id}`;

  for (const suffix of ["", "/produits", "/produits/nouveau", "/publication-rapide", "/stock", "/videos", "/messages", "/commandes", "/demandes", "/avis", "/blocages", "/reglages"]) {
    await auditPage(page, `${base}${suffix}`);
    await auditPage(page, `/ar${base}${suffix}`);
  }
});

test("administration à 320 px, français et arabe", async ({ page }) => {
  const manager = await createAdminUser();

  await signIn(page, manager.email);
  await page.setViewportSize({ width: 320, height: 640 });

  for (const path of ["/admin", "/admin/boutiques", "/admin/produits", "/admin/commandes", "/admin/signalements", "/admin/avis", "/admin/videos", "/admin/categories", "/admin/lieux", "/admin/audit", "/admin/utilisateurs", "/compte/securite"]) {
    await auditPage(page, path);
    await auditPage(page, `/ar${path}`);
  }
});

test("navigation : tous les onglets mobiles répondent, en arabe aussi", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });

  for (const prefix of ["", "/ar"]) {
    await page.goto(`${prefix}/catalogue`);
    const tabs = page.getByRole("navigation").last().getByRole("link");
    const count = await tabs.count();
    expect(count).toBe(5);

    for (let index = 0; index < count; index += 1) {
      const box = await tabs.nth(index).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }
  }
});

test("commande complète au téléphone, paiement à la livraison, clavier simulé", async ({ page }) => {
  const shop = await createApprovedShop();
  const product = await seedProduct(shop.id);
  const client = await createConfirmedUser("tel");

  await signIn(page, client.email, `/produit/${product.id}`);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  await expect(page.getByRole("link", { name: "Voir le panier" })).toBeVisible();
  await page.goto("/commande");

  // Simule le clavier virtuel : la hauteur utile tombe de moitié, le champ actif doit rester visible.
  await page.setViewportSize({ width: 320, height: 320 });

  const address = page.getByLabel("Rue, numéro, immeuble");
  await page.getByLabel("Téléphone").fill("22123456");
  await page.getByLabel("Gouvernorat").selectOption({ label: "Tunis" });
  await page.getByLabel("Ville").selectOption({ index: 1 });
  await address.fill("12 rue de la Liberté");
  await address.focus();
  await expect(address).toBeInViewport();

  const submit = page.getByRole("button", { name: "Confirmer la commande" });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();

  await expect(page.getByText("Paiement à la livraison", { exact: false }).first()).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/commande\/confirmation/);
});

test("messagerie au téléphone : le champ reste atteignable avec le clavier simulé", async ({ page }) => {
  const shop = await createApprovedShop();
  const client = await createConfirmedUser("clavier");
  const supabase = await clientFor(client.email);

  const { data: conversationId } = await supabase.rpc("start_conversation", {
    p_shop_id: shop.id,
    p_product_id: null,
    p_request_id: null,
    p_body: "Premier",
  });

  for (let index = 0; index < 14; index += 1) {
    await supabase.rpc("send_message", { p_conversation_id: conversationId, p_body: `Message ${index}` });
  }

  await signIn(page, client.email, `/compte/messages/${conversationId}`);
  await page.setViewportSize({ width: 320, height: 300 });

  const input = page.getByRole("textbox", { name: "Écris ton message" });
  await input.scrollIntoViewIfNeeded();
  await input.focus();
  await expect(input).toBeInViewport();

  const tabbar = await page.getByRole("navigation").last().boundingBox();
  const field = await input.boundingBox();
  expect(field!.y + field!.height).toBeLessThanOrEqual(tabbar!.y + 1);

  await input.fill("Réponse depuis le téléphone");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText("Réponse depuis le téléphone")).toBeVisible();
});

test("modales : tenues dans l'écran, boutons atteignables, fermeture", async ({ page }) => {
  const shop = await createApprovedShop();
  const client = await createConfirmedUser("modale");

  await signIn(page, client.email, `/boutique/${shop.slug}`);

  for (const size of [{ width: 320, height: 568 }, { width: 320, height: 320 }]) {
    await page.setViewportSize(size);
    await page.getByRole("button", { name: "Signaler" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);

    const send = dialog.getByRole("button", { name: "Envoyer le signalement" });
    await send.scrollIntoViewIfNeeded();
    await expect(send).toBeInViewport();

    await dialog.getByRole("button", { name: "Annuler" }).click();
    await expect(dialog).toHaveCount(0);
  }
});

test("formulaires : envoi de photo et de vidéo utilisables à 320 px", async ({ page }) => {
  const shop = await createApprovedShop();

  await signIn(page, shop.owner.email);
  await page.setViewportSize({ width: 320, height: 568 });

  for (const path of ["publication-rapide", "videos"]) {
    await page.goto(`/vendeur/boutique/${shop.id}/${path}`);
    const input = page.locator("input[type=file]").first();
    await expect(input).toHaveCount(1);
    expect(await input.getAttribute("accept")).toBeTruthy();
  }
});
